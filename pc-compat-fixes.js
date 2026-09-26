// ==============================================
// pc-compat-fixes.js v1 (TEST)
// ==============================================
// ✅ إصلاحات الكمبيوتر فقط — لا يعمل على الموبايل
// ✅ لا يكسر أي شي — override نظيف + fallback
// ✅ يمكن تعطيله: احذف السطر من index.html
// ==============================================
//   1. Stories: وسط قابل للنقر + unmute + مفاتيح كيبورد
//   2. YouTube: timeout 10s + fallback تلقائي + unmute
//   3. Upload: ضغط تلقائي + ترتيب محسّن + progress + رسائل واضحة
// ==============================================

(function () {
    'use strict';
    if (window.__pcCompatV1) return;
    window.__pcCompatV1 = true;

    // ══════════════════════════════════════════════
    // فحص البيئة — PC فقط
    // ══════════════════════════════════════════════
    var IS_PC = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!IS_PC) {
        console.log('💻 pc-compat-fixes: skipped on mobile');
        return;
    }

    console.log('💻 pc-compat-fixes v1: applying PC fixes...');

    // ══════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════
    function _safe(fn, label) {
        return function () {
            try { return fn.apply(this, arguments); }
            catch (e) {
                console.warn('pc-compat [' + label + '] failed:', e);
            }
        };
    }

    function _esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    // ══════════════════════════════════════════════
    // CSS
    // ══════════════════════════════════════════════
    (function injectCSS() {
        if (document.getElementById('pc-compat-css')) return;
        var s = document.createElement('style');
        s.id = 'pc-compat-css';
        s.textContent = `
/* ═══ Stories — وسط قابل للنقر ═══ */
#story-content-holder {
    cursor: pointer !important;
    touch-action: auto !important;
}
#story-viewer {
    touch-action: auto !important;
}

/* ═══ Stories — زر Unmute ═══ */
.pc-unmute-btn {
    position: absolute;
    top: 75px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    border: 2px solid #ffd700;
    color: #ffd700;
    padding: 10px 20px;
    border-radius: 25px;
    font-family: 'Cairo', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    z-index: 9999999;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8), 0 0 20px rgba(255,215,0,0.4);
    animation: pcUnmutePulse 2s ease-in-out infinite;
}
.pc-unmute-btn:hover {
    background: rgba(255,215,0,0.2);
    transform: translateX(-50%) scale(1.05);
}
@keyframes pcUnmutePulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.8), 0 0 20px rgba(255,215,0,0.4); }
    50%      { box-shadow: 0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,215,0,0.9); }
}

/* ═══ Stories — تلميح الكيبورد ═══ */
.pc-keyboard-hint {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0,0,0,0.8);
    border: 1px solid rgba(255,215,0,0.4);
    color: #ccc;
    padding: 8px 14px;
    border-radius: 10px;
    font-family: 'Cairo', sans-serif;
    font-size: 11px;
    font-weight: 700;
    z-index: 9999999;
    direction: rtl;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    line-height: 1.6;
}
.pc-keyboard-hint.show { opacity: 1; }
.pc-keyboard-hint kbd {
    background: rgba(255,255,255,0.1);
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.2);
    font-family: monospace;
    font-size: 10px;
    color: #ffd700;
    margin: 0 2px;
}

/* ═══ YouTube — زر fallback دائم ═══ */
.pc-yt-persistent-btn {
    background: #ff0000 !important;
    color: #fff !important;
    font-weight: 900 !important;
    animation: pcYtPulse 1.5s ease-in-out infinite;
}
@keyframes pcYtPulse {
    0%, 100% { box-shadow: 0 0 10px rgba(255,0,0,0.5); }
    50%      { box-shadow: 0 0 25px rgba(255,0,0,1); }
}

/* ═══ YouTube — unmute في mini player ═══ */
.pc-yt-unmute {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.9);
    border: 2px solid #ffd700;
    color: #ffd700;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}
.pc-yt-unmute:hover { transform: scale(1.1); background: rgba(255,215,0,0.2); }

/* ═══ Upload — Progress Bar ═══ */
.pc-upload-progress {
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(15,15,25,0.98);
    border: 2px solid #ffd700;
    border-radius: 14px;
    padding: 14px 18px;
    z-index: 9999999;
    font-family: 'Cairo', sans-serif;
    direction: rtl;
    min-width: 260px;
    max-width: 340px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.9), 0 0 30px rgba(255,215,0,0.3);
    animation: pcUploadIn 0.3s ease-out;
}
@keyframes pcUploadIn {
    from { opacity: 0; transform: translateX(40px); }
    to   { opacity: 1; transform: translateX(0); }
}
.pc-upload-progress.closing {
    animation: pcUploadOut 0.3s ease-in forwards;
}
@keyframes pcUploadOut {
    to { opacity: 0; transform: translateX(40px); }
}
.pc-upload-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}
.pc-upload-icon {
    font-size: 20px;
    animation: pcUploadSpin 1.5s linear infinite;
    display: inline-block;
}
.pc-upload-icon.done {
    animation: none;
    color: #4ade80;
}
.pc-upload-icon.error {
    animation: none;
    color: #ff6666;
}
@keyframes pcUploadSpin {
    to { transform: rotate(360deg); }
}
.pc-upload-label {
    flex: 1;
    color: #fff;
    font-size: 13px;
    font-weight: 900;
}
.pc-upload-pct {
    color: #ffd700;
    font-size: 13px;
    font-weight: 900;
}
.pc-upload-bar-track {
    height: 6px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    overflow: hidden;
}
.pc-upload-bar-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #ffd700, #d4af37);
    border-radius: 3px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(255,215,0,0.6);
}
.pc-upload-bar-fill.error {
    background: linear-gradient(90deg, #ff4444, #cc0000);
    box-shadow: 0 0 10px rgba(255,68,68,0.6);
}
.pc-upload-status {
    color: #888;
    font-size: 11px;
    margin-top: 8px;
    text-align: center;
    min-height: 14px;
}
        `;
        document.head.appendChild(s);
    })();

    // ══════════════════════════════════════════════
    // ▓▓▓ 1. Stories Fixes ▓▓▓
    // ══════════════════════════════════════════════
    (function storiesFixes() {
        var _activeViewer = null;
        var _unmuteBtn = null;
        var _hintEl = null;

        // ─── 1.1 وسط قابل للنقر ───
        function installMiddleTap() {
            var holder = document.getElementById('story-content-holder');
            if (!holder || holder.__pcMidTap) return;
            holder.__pcMidTap = true;

            holder.addEventListener('click', function (e) {
                // تجنب النقر على عناصر تحكم (فيديو controls)
                if (e.target.tagName === 'VIDEO' && e.target.controls) return;
                if (e.target.closest('.pc-unmute-btn')) return;

                // Middle tap → next
                e.preventDefault();
                e.stopPropagation();
                var nextZone = document.getElementById('story-next-zone');
                if (nextZone) nextZone.click();
            });
        }

        // ─── 1.2 زر Unmute ───
        function removeUnmuteBtn() {
            if (_unmuteBtn && _unmuteBtn.parentNode) {
                _unmuteBtn.parentNode.removeChild(_unmuteBtn);
            }
            _unmuteBtn = null;
        }

        function addUnmuteBtn(video) {
            removeUnmuteBtn();
            var viewer = document.getElementById('story-viewer');
            if (!viewer) return;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pc-unmute-btn';
            btn.innerHTML = '🔊 اضغط لتشغيل الصوت';
            btn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (video) {
                    video.muted = false;
                    video.volume = 1.0;
                    video.play().catch(function () {});
                }
                removeUnmuteBtn();
            };
            viewer.appendChild(btn);
            _unmuteBtn = btn;
        }

        function checkVideoMuted() {
            var viewer = document.getElementById('story-viewer');
            if (!viewer || !viewer.classList.contains('active')) {
                removeUnmuteBtn();
                return;
            }
            var video = viewer.querySelector('video.story-content-video');
            if (!video) {
                removeUnmuteBtn();
                return;
            }
            if (video.muted && !video.paused) {
                if (!_unmuteBtn) addUnmuteBtn(video);
            } else {
                removeUnmuteBtn();
            }
        }

        // ─── 1.3 تلميح الكيبورد ───
        function showKeyboardHint() {
            if (!_hintEl) {
                _hintEl = document.createElement('div');
                _hintEl.className = 'pc-keyboard-hint';
                _hintEl.innerHTML =
                    '<kbd>→</kbd> التالي &nbsp; <kbd>←</kbd> السابق<br>' +
                    '<kbd>Esc</kbd> إغلاق &nbsp; <kbd>Space</kbd> إيقاف';
                document.body.appendChild(_hintEl);
            }
            _hintEl.classList.add('show');
            setTimeout(function () {
                if (_hintEl) _hintEl.classList.remove('show');
            }, 3500);
        }

        function removeKeyboardHint() {
            if (_hintEl) _hintEl.classList.remove('show');
        }

        // ─── 1.4 Keyboard Shortcuts ───
        document.addEventListener('keydown', function (e) {
            var viewer = document.getElementById('story-viewer');
            if (!viewer || !viewer.classList.contains('active')) return;

            // لا تتدخل في input/textarea
            var tag = (document.activeElement || {}).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    document.activeElement.blur();
                }
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                var nextZone = document.getElementById('story-next-zone');
                if (nextZone) nextZone.click();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                var prevZone = document.getElementById('story-prev-zone');
                if (prevZone) prevZone.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                var closeBtn = document.getElementById('story-viewer-close');
                if (closeBtn) closeBtn.click();
            } else if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                if (typeof window.Stories !== 'undefined' && window.Stories.pause && window.Stories.resume) {
                    if (window.Stories.isPaused && window.Stories.isPaused()) {
                        window.Stories.resume();
                    } else {
                        window.Stories.pause();
                    }
                }
            }
        });

        // ─── 1.5 Observer لمراقبة ظهور Stories ───
        function watchViewer() {
            var viewer = document.getElementById('story-viewer');
            if (!viewer) {
                setTimeout(watchViewer, 1000);
                return;
            }
            if (viewer.__pcWatched) return;
            viewer.__pcWatched = true;

            new MutationObserver(function () {
                var isActive = viewer.classList.contains('active');
                if (isActive) {
                    installMiddleTap();
                    showKeyboardHint();
                    // راقب الفيديو دورياً
                    if (!viewer.__pcVideoTimer) {
                        viewer.__pcVideoTimer = setInterval(checkVideoMuted, 500);
                    }
                } else {
                    removeKeyboardHint();
                    removeUnmuteBtn();
                    if (viewer.__pcVideoTimer) {
                        clearInterval(viewer.__pcVideoTimer);
                        viewer.__pcVideoTimer = null;
                    }
                }
            }).observe(viewer, { attributes: true, attributeFilter: ['class'] });

            // لو مفتوح مسبقاً
            if (viewer.classList.contains('active')) {
                installMiddleTap();
                showKeyboardHint();
            }
        }

        // ─── تشغيل ───
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', watchViewer);
        } else {
            watchViewer();
        }
    })();

    // ══════════════════════════════════════════════
    // ▓▓▓ 2. YouTube Fixes ▓▓▓
    // ══════════════════════════════════════════════
    (function youtubeFixes() {
        var YT_TIMEOUT_MS = 10000; // لو الأصلي تجاوز 10s → fallback
        var _currentTimer = null;

        // ─── 2.1 مراقبة البحث — timeout 10s ───
        function watchSearchBody() {
            var body = document.getElementById('yt-search-body');
            if (!body) return;

            if (body.__pcWatched) return;
            body.__pcWatched = true;

            new MutationObserver(function () {
                // لو ظهر "جاري البحث" → ابدأ مؤقت
                var loading = body.querySelector('.yt-loading');
                if (loading) {
                    if (_currentTimer) clearTimeout(_currentTimer);
                    _currentTimer = setTimeout(function () {
                        var stillLoading = body.querySelector('.yt-loading');
                        if (stillLoading) {
                            showTimeoutFallback();
                        }
                    }, YT_TIMEOUT_MS);
                } else {
                    if (_currentTimer) {
                        clearTimeout(_currentTimer);
                        _currentTimer = null;
                    }
                }
            }).observe(body, { childList: true, subtree: true });
        }

        function showTimeoutFallback() {
            var body = document.getElementById('yt-search-body');
            if (!body) return;

            var inp = document.getElementById('yt-search-input');
            var query = inp ? inp.value.trim() : '';

            body.innerHTML =
                '<div class="yt-fallback">' +
                    '<div class="yt-fallback-icon">⏱️</div>' +
                    '<div class="yt-fallback-title">البحث يأخذ وقتاً طويلاً</div>' +
                    '<div class="yt-fallback-desc">' +
                        'يبدو أن خدمات البحث المجانية مشغولة الآن.<br>' +
                        'يمكنك فتح يوتيوب مباشرة — سيكون أسرع.' +
                    '</div>' +
                    '<button class="yt-fallback-btn" id="pc-yt-timeout-open" type="button">' +
                        '🌐 افتح يوتيوب مباشرة' +
                    '</button>' +
                '</div>';

            var btn = document.getElementById('pc-yt-timeout-open');
            if (btn) {
                btn.onclick = function () {
                    if (query) {
                        window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(query), '_blank');
                    } else {
                        window.open('https://www.youtube.com', '_blank');
                    }
                };
            }

            // أزل الحالة loading من الزر الأصلي
            var searchBtn = document.getElementById('yt-search-btn');
            if (searchBtn) searchBtn.disabled = false;
        }

        // ─── 2.2 زر "افتح يوتيوب" دائم في الأعلى ───
        function enhanceQuickActions() {
            var actions = document.getElementById('yt-quick-actions');
            if (!actions || actions.__pcEnhanced) return;
            actions.__pcEnhanced = true;

            var existingBtn = actions.querySelector('#yt-open-external');
            if (existingBtn) {
                existingBtn.classList.add('pc-yt-persistent-btn');
                existingBtn.innerHTML = '🌐 فتح في يوتيوب مباشرة';
            }
        }

        // ─── 2.3 مراقبة mini player → زر unmute ───
        function watchMiniPlayer() {
            var player = document.getElementById('yt-mini-player');
            if (!player) return;
            if (player.__pcWatched) return;
            player.__pcWatched = true;

            new MutationObserver(function () {
                if (player.classList.contains('active')) {
                    setTimeout(addMiniPlayerUnmute, 500);
                }
            }).observe(player, { attributes: true, attributeFilter: ['class'] });
        }

        function addMiniPlayerUnmute() {
            var body = document.getElementById('yt-mini-body');
            if (!body) return;
            var iframe = body.querySelector('iframe');
            if (!iframe) return;

            // حذف الزر القديم
            var old = body.querySelector('.pc-yt-unmute');
            if (old) old.remove();

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pc-yt-unmute';
            btn.innerHTML = '🔊';
            btn.title = 'تفعيل الصوت';
            btn.onclick = function (e) {
                e.stopPropagation();
                // إعادة تحميل iframe بدون mute
                var src = iframe.src;
                src = src.replace(/[?&]mute=1/g, '');
                if (src.indexOf('?') === -1) src += '?autoplay=1';
                iframe.src = src;
                btn.remove();
            };
            body.appendChild(btn);
        }

        // ─── 2.4 راقب ظهور dialog ───
        function watchDialog() {
            var dialog = document.getElementById('yt-search-overlay');
            if (!dialog) {
                setTimeout(watchDialog, 1000);
                return;
            }
            if (dialog.__pcWatched) return;
            dialog.__pcWatched = true;

            new MutationObserver(function () {
                if (dialog.classList.contains('active')) {
                    setTimeout(enhanceQuickActions, 100);
                    setTimeout(watchSearchBody, 100);
                    setTimeout(watchMiniPlayer, 100);
                }
            }).observe(dialog, { attributes: true, attributeFilter: ['class'] });
        }

        // ─── تشغيل ───
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', watchDialog);
        } else {
            watchDialog();
        }
    })();

    // ══════════════════════════════════════════════
    // ▓▓▓ 3. Upload Fixes ▓▓▓
    // ══════════════════════════════════════════════
    (function uploadFixes() {
        var MAX_IMAGE_BYTES = 20 * 1024 * 1024;   // 20 MB (كان 10)
        var MAX_AUDIO_BYTES = 30 * 1024 * 1024;   // 30 MB (كان 10)
        var MAX_VIDEO_BYTES = 50 * 1024 * 1024;   // 50 MB (كان 20)
        var COMPRESS_THRESHOLD = 3 * 1024 * 1024; // ضغط تلقائي فوق 3 MB

        var _progressEl = null;
        var _progressTimer = null;
        var _progressStart = 0;
        var _progressStage = 0;

        // ─── 3.1 Progress UI ───
        function showProgress(label) {
            hideProgress();
            _progressStart = Date.now();
            _progressStage = 0;

            var el = document.createElement('div');
            el.className = 'pc-upload-progress';
            el.innerHTML =
                '<div class="pc-upload-header">' +
                    '<span class="pc-upload-icon">⏳</span>' +
                    '<span class="pc-upload-label">' + _esc(label || 'جاري الرفع...') + '</span>' +
                    '<span class="pc-upload-pct">0%</span>' +
                '</div>' +
                '<div class="pc-upload-bar-track">' +
                    '<div class="pc-upload-bar-fill"></div>' +
                '</div>' +
                '<div class="pc-upload-status">جاري التحضير...</div>';

            document.body.appendChild(el);
            _progressEl = el;

            // تقدم تقديري بناءً على الزمن (لأن fetch لا يدعم progress)
            _progressTimer = setInterval(function () {
                if (!_progressEl) return;
                var elapsed = Date.now() - _progressStart;
                var pct = getEstimatedProgress(elapsed);
                updateProgressBar(pct);
            }, 300);
        }

        function getEstimatedProgress(elapsed) {
            // 0-2s → 0-30%   (تحضير)
            // 2-15s → 30-80% (رفع)
            // 15-30s → 80-95% (معالجة)
            // >30s → 95-98% (انتظار)
            if (elapsed < 2000) return (elapsed / 2000) * 30;
            if (elapsed < 15000) return 30 + ((elapsed - 2000) / 13000) * 50;
            if (elapsed < 30000) return 80 + ((elapsed - 15000) / 15000) * 15;
            return 95 + Math.min(3, (elapsed - 30000) / 10000 * 3);
        }

        function updateProgressBar(pct) {
            if (!_progressEl) return;
            pct = Math.min(98, Math.max(0, pct));
            var fill = _progressEl.querySelector('.pc-upload-bar-fill');
            var pctEl = _progressEl.querySelector('.pc-upload-pct');
            var statusEl = _progressEl.querySelector('.pc-upload-status');

            if (fill) fill.style.width = pct + '%';
            if (pctEl) pctEl.textContent = Math.round(pct) + '%';

            if (statusEl) {
                if (pct < 30) statusEl.textContent = 'جاري التحضير...';
                else if (pct < 80) statusEl.textContent = 'جاري الرفع...';
                else if (pct < 95) statusEl.textContent = 'جاري المعالجة...';
                else statusEl.textContent = 'على وشك الاكتمال...';
            }
        }

        function finishProgress(success, message) {
            if (!_progressEl) return;
            clearInterval(_progressTimer);
            _progressTimer = null;

            var fill = _progressEl.querySelector('.pc-upload-bar-fill');
            var pctEl = _progressEl.querySelector('.pc-upload-pct');
            var icon = _progressEl.querySelector('.pc-upload-icon');
            var label = _progressEl.querySelector('.pc-upload-label');
            var status = _progressEl.querySelector('.pc-upload-status');

            if (fill) fill.style.width = '100%';
            if (pctEl) pctEl.textContent = '100%';

            if (success) {
                if (icon) { icon.textContent = '✅'; icon.classList.add('done'); }
                if (label) label.textContent = 'تم الرفع بنجاح';
                if (status) status.textContent = message || '';
            } else {
                if (icon) { icon.textContent = '❌'; icon.classList.add('error'); }
                if (fill) fill.classList.add('error');
                if (label) label.textContent = 'فشل الرفع';
                if (status) status.textContent = message || '';
            }

            // إغلاق تلقائي بعد 2.5 ثانية
            setTimeout(hideProgress, 2500);
        }

        function hideProgress() {
            if (!_progressEl) return;
            var el = _progressEl;
            _progressEl = null;
            el.classList.add('closing');
            setTimeout(function () {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }, 350);
        }

        // ─── 3.2 ضغط الصور تلقائياً ───
        async function maybeCompressImage(file) {
            if (!file || !file.type) return file;
            if (file.type.indexOf('image/') !== 0) return file;
            if (file.size < COMPRESS_THRESHOLD) return file;
            // لا نضغط GIF (تفقد الحركة)
            if (file.type === 'image/gif') return file;

            try {
                if (typeof window.UploadService !== 'undefined' &&
                    typeof window.UploadService.convertImageToJpg === 'function') {
                    var converted = await window.UploadService.convertImageToJpg(file, 2400, 0.88);
                    if (converted && converted.size < file.size) {
                        console.log('💻 pc-compat: compressed ' +
                            (file.size / 1024).toFixed(0) + 'KB → ' +
                            (converted.size / 1024).toFixed(0) + 'KB');
                        return converted;
                    }
                }
            } catch (e) {
                console.warn('pc-compat: compress failed, using original', e);
            }
            return file;
        }

        // ─── 3.3 التحقق من الحجم ───
        function checkSize(file) {
            if (!file) return { ok: false, msg: 'لا يوجد ملف' };
            var type = (file.type || '').toLowerCase();

            if (type.indexOf('image/') === 0 && file.size > MAX_IMAGE_BYTES) {
                return {
                    ok: false,
                    msg: 'الصورة كبيرة جداً (' + (file.size / 1024 / 1024).toFixed(1) + 'MB) — الحد 20MB'
                };
            }
            if (type.indexOf('audio/') === 0 && file.size > MAX_AUDIO_BYTES) {
                return {
                    ok: false,
                    msg: 'الملف الصوتي كبير جداً (' + (file.size / 1024 / 1024).toFixed(1) + 'MB) — الحد 30MB'
                };
            }
            if (type.indexOf('video/') === 0 && file.size > MAX_VIDEO_BYTES) {
                return {
                    ok: false,
                    msg: 'الفيديو كبير جداً (' + (file.size / 1024 / 1024).toFixed(1) + 'MB) — الحد 50MB'
                };
            }
            return { ok: true };
        }

        // ─── 3.4 Wrapper على UploadService ───
        function patchUploadService() {
            if (typeof window.UploadService === 'undefined') {
                setTimeout(patchUploadService, 500);
                return;
            }
            if (window.UploadService.__pcCompat) return;
            window.UploadService.__pcCompat = true;

            var _origUpload = window.UploadService.upload;

            window.UploadService.upload = async function (file, opts) {
                if (!file) throw new Error('لا يوجد ملف');

                // 1. فحص الحجم
                var sizeCheck = checkSize(file);
                if (!sizeCheck.ok) {
                    if (typeof showToast === 'function') showToast('fa-exclamation-triangle', '⚠️ ' + sizeCheck.msg);
                    throw new Error(sizeCheck.msg);
                }

                // 2. ضغط إن كان صورة
                var processedFile = file;
                var isImage = (file.type || '').indexOf('image/') === 0;
                if (isImage && file.size > COMPRESS_THRESHOLD && file.type !== 'image/gif') {
                    showProgress('جاري ضغط الصورة...');
                    processedFile = await maybeCompressImage(file);
                } else {
                    var label = isImage ? 'صورة'
                        : (file.type || '').indexOf('video/') === 0 ? 'فيديو'
                        : (file.type || '').indexOf('audio/') === 0 ? 'صوت'
                        : 'ملف';
                    showProgress('جاري رفع ' + label + '...');
                }

                // 3. الرفع الفعلي
                try {
                    var url = await _origUpload.call(this, processedFile, opts);
                    finishProgress(true, processedFile.size < file.size
                        ? 'تم الضغط: ' + (file.size / 1024).toFixed(0) + 'KB → ' + (processedFile.size / 1024).toFixed(0) + 'KB'
                        : '');
                    return url;
                } catch (e) {
                    // رسالة خطأ واضحة
                    var errMsg = (e && e.message) || 'فشل الرفع';
                    if (errMsg.indexOf('timeout') !== -1) {
                        errMsg = 'انتهت المهلة — قد تكون الشبكة بطيئة. حاول مرة أخرى.';
                    } else if (errMsg.indexOf('quota') !== -1 || errMsg.indexOf('limit') !== -1) {
                        errMsg = 'خدمة الرفع ممتلئة مؤقتاً — حاول بعد دقيقة.';
                    } else if (errMsg.length > 100) {
                        errMsg = errMsg.substring(0, 100) + '...';
                    }
                    finishProgress(false, errMsg);
                    throw e;
                }
            };

            console.log('💻 pc-compat: UploadService patched');
        }

        // ─── 3.5 مراقبة toast "تم رفع 0" ───
        function patchToastForSilentFails() {
            if (typeof window.showToast !== 'function') {
                setTimeout(patchToastForSilentFails, 500);
                return;
            }
            if (window.showToast.__pcCompat) return;

            var _origToast = window.showToast;
            window.showToast = function (icon, msg, duration) {
                // كشف "تم رفع 0"
                if (typeof msg === 'string' && msg.indexOf('تم رفع 0') !== -1) {
                    icon = 'fa-exclamation-triangle';
                    msg = '⚠️ لم يتم رفع أي ملف — قد يكون الحجم كبيراً أو الاتصال ضعيفاً';
                }
                // كشف "فشل الرفع" العام
                if (typeof msg === 'string' && msg === '⚠️ فشل') {
                    msg = '⚠️ فشل الرفع — حاول مرة أخرى';
                }
                return _origToast.call(this, icon, msg, duration);
            };
            window.showToast.__pcCompat = true;
            console.log('💻 pc-compat: toast patched');
        }

        // ─── تشغيل ───
        patchUploadService();
        patchToastForSilentFails();
    })();

    // ══════════════════════════════════════════════
    // Public API (للتحكم)
    // ══════════════════════════════════════════════
    window.PcCompat = {
        version: 1,
        isPc: IS_PC,
        info: function () {
            console.log('💻 PcCompat v1 — status:');
            console.log('  - Stories: middle tap + unmute + keyboard shortcuts');
            console.log('  - YouTube: 10s timeout + persistent external link + unmute');
            console.log('  - Upload: compression + progress + clear errors + size check');
        }
    };

    console.log('✅ pc-compat-fixes.js v1 (TEST) loaded — PC-only fixes, zero impact on mobile');
})();
