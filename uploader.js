// ==============================================
// uploader.js v8 — Race بالتوازي (أسرع 10x)
// ==============================================
// ✅ v8 (فوق v7):
//   1. Race بالتوازي للصوت (catbox + 0x0 + TG معاً)
//   2. أول نجاح يفوز → سرعة فورية
//   3. fallback لـ Promise.any (Safari قديم)
//   4. timeout إجمالي 25s (بدل 90s)
// ✅ v7 (محفوظ):
//   - Toast تفصيلي
//   - Timeouts لكل خدمة
//   - دعم صيغ صوت موسّع
// ==============================================

(function () {
    'use strict';
    if (window.__uploadServiceV8) return;
    window.__uploadServiceV8 = true;

    var TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    var TG_CHAT_ID = '-1003978647266';
    var TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;
    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';

    var TIMEOUTS = {
        imgbb: 30000,
        catbox: 25000,
        '0x0': 25000,
        telegram: 60000
    };

    // Total race timeout
    var AUDIO_RACE_TIMEOUT_MS = 30000;

    var _lastMeta = null;

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        console.log('[Uploader]', icon, msg);
    }

    /**
     * ⭐ v8: Promise.any مع fallback
     */
    function promiseAny(promises) {
        if (typeof Promise.any === 'function') {
            return Promise.any(promises);
        }
        // Fallback للـ Safari القديم
        return new Promise(function (resolve, reject) {
            var errors = [];
            var pending = promises.length;
            if (pending === 0) return reject(new Error('empty'));
            promises.forEach(function (p, i) {
                Promise.resolve(p).then(resolve, function (err) {
                    errors[i] = err;
                    pending--;
                    if (pending === 0) {
                        var e = new Error('All failed');
                        e.errors = errors;
                        reject(e);
                    }
                });
            });
        });
    }

    function fetchWithTimeout(url, options, timeoutMs, label) {
        return new Promise(function (resolve, reject) {
            var controller = new AbortController();
            var timer = setTimeout(function () {
                controller.abort();
                reject(new Error(label + ' — timeout'));
            }, timeoutMs);

            fetch(url, Object.assign({}, options, { signal: controller.signal }))
                .then(function (res) { clearTimeout(timer); resolve(res); })
                .catch(function (err) {
                    clearTimeout(timer);
                    if (err.name === 'AbortError') {
                        reject(new Error(label + ' — timeout'));
                    } else {
                        reject(new Error(label + ' — ' + (err.message || 'network')));
                    }
                });
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Telegram                                       */
    /* ══════════════════════════════════════════════ */
    async function uploadTelegramDocument(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('document', file);
        var res = await fetchWithTimeout(TG_API + '/sendDocument', { method: 'POST', body: fd }, TIMEOUTS.telegram, 'TG doc');
        if (!res.ok) throw new Error('TG doc HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result || !data.result.document) {
            throw new Error('TG doc: ' + (data.description || 'bad'));
        }
        var fileId = data.result.document.file_id;
        var messageId = data.result.message_id;
        var fileRes = await fetchWithTimeout(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId), {}, 15000, 'TG getFile');
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('TG getFile failed');
        }
        _lastMeta = { service: 'telegram', tgMessageId: messageId, fileId: fileId };
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

    async function uploadTelegramAudio(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('audio', file);
        var res = await fetchWithTimeout(TG_API + '/sendAudio', { method: 'POST', body: fd }, TIMEOUTS.telegram, 'TG audio');
        if (!res.ok) throw new Error('TG audio HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result) {
            throw new Error('TG audio: ' + (data.description || 'bad'));
        }
        var fileId = null;
        if (data.result.audio && data.result.audio.file_id) fileId = data.result.audio.file_id;
        else if (data.result.document && data.result.document.file_id) fileId = data.result.document.file_id;
        else if (data.result.voice && data.result.voice.file_id) fileId = data.result.voice.file_id;
        if (!fileId) throw new Error('TG audio: no file_id');
        var messageId = data.result.message_id;
        var fileRes = await fetchWithTimeout(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId), {}, 15000, 'TG getFile');
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('TG getFile failed');
        }
        _lastMeta = { service: 'telegram', tgMessageId: messageId, fileId: fileId };
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

    async function uploadTelegramVideo(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('video', file);
        fd.append('supports_streaming', 'true');
        var res = await fetchWithTimeout(TG_API + '/sendVideo', { method: 'POST', body: fd }, TIMEOUTS.telegram, 'TG video');
        if (!res.ok) throw new Error('TG video HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result) {
            throw new Error('TG video: ' + (data.description || 'bad'));
        }
        var fileId = null;
        if (data.result.video && data.result.video.file_id) fileId = data.result.video.file_id;
        else if (data.result.animation && data.result.animation.file_id) fileId = data.result.animation.file_id;
        else if (data.result.document && data.result.document.file_id) fileId = data.result.document.file_id;
        if (!fileId) throw new Error('TG video: no file_id');
        var messageId = data.result.message_id;
        var fileRes = await fetchWithTimeout(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId), {}, 15000, 'TG getFile');
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('TG getFile failed');
        }
        _lastMeta = { service: 'telegram', tgMessageId: messageId, fileId: fileId };
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

    /* ══════════════════════════════════════════════ */
    /* catbox / 0x0 / imgbb                           */
    /* ══════════════════════════════════════════════ */
    async function uploadCatbox(file) {
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('fileToUpload', file);
        var res = await fetchWithTimeout('https://catbox.moe/user/api.php', { method: 'POST', body: fd }, TIMEOUTS.catbox, 'catbox');
        if (!res.ok) throw new Error('catbox HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('catbox: ' + text.substring(0, 80));
        }
        _lastMeta = { service: 'catbox', tgMessageId: null, fileId: null };
        return text;
    }

    async function upload0x0(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetchWithTimeout('https://0x0.st', { method: 'POST', body: fd }, TIMEOUTS['0x0'], '0x0.st');
        if (!res.ok) throw new Error('0x0 HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('0x0: ' + text.substring(0, 80));
        }
        _lastMeta = { service: '0x0', tgMessageId: null, fileId: null };
        return text;
    }

    async function uploadImgbb(file) {
        var fd = new FormData();
        fd.append('key', IMGBB_KEY);
        fd.append('image', file);
        var res = await fetchWithTimeout('https://api.imgbb.com/1/upload', { method: 'POST', body: fd }, TIMEOUTS.imgbb, 'imgbb');
        var data = await res.json();
        if (!data.success || !data.data || !data.data.url) {
            throw new Error('imgbb: ' + (data.error && data.error.message || 'unknown'));
        }
        _lastMeta = { service: 'imgbb', tgMessageId: null, fileId: null };
        return data.data.url;
    }

    /* ══════════════════════════════════════════════ */
    /* Image conversion                               */
    /* ══════════════════════════════════════════════ */
    function convertImageToJpg(file, maxSize, quality) {
        return new Promise(function (resolve, reject) {
            maxSize = maxSize || 1920;
            quality = quality || 0.88;
            var reader = new FileReader();
            reader.onload = function (e) {
                var img = new Image();
                img.onload = function () {
                    try {
                        var canvas = document.createElement('canvas');
                        var w = img.width, h = img.height;
                        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
                        else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
                        canvas.width = w; canvas.height = h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        canvas.toBlob(function (blob) {
                            if (!blob) { reject(new Error('convert failed')); return; }
                            var newName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
                            resolve(new File([blob], newName, { type: 'image/jpeg' }));
                        }, 'image/jpeg', quality);
                    } catch (err) { reject(err); }
                };
                img.onerror = function () { reject(new Error('image load failed')); };
                img.src = e.target.result;
            };
            reader.onerror = function () { reject(new Error('read failed')); };
            reader.readAsDataURL(file);
        });
    }

    function needsConversion(file) {
        if (!file || !file.type) return false;
        return ['image/heic','image/heif','image/avif','image/tiff','image/bmp']
            .indexOf(file.type) !== -1;
    }

    /* ══════════════════════════════════════════════ */
    /* tryChain — تسلسلي                              */
    /* ══════════════════════════════════════════════ */
    async function tryChain(attempts, fileLabel) {
        var errors = [];
        var totalCount = attempts.length;

        for (var i = 0; i < attempts.length; i++) {
            var name = attempts[i].name;
            var fn = attempts[i].fn;
            toast('fa-spinner', '⏳ ' + fileLabel + ' — جرّب ' + name + ' (' + (i + 1) + '/' + totalCount + ')...');

            try {
                var url = await fn();
                toast('fa-check', '✅ تم عبر ' + name);
                return url;
            } catch (e) {
                var errMsg = (e.message || 'خطأ').substring(0, 60);
                console.warn('❌ ' + name + ' failed:', e.message);
                errors.push(name + ': ' + errMsg);
            }
        }

        throw new Error(errors.join(' | '));
    }

    /* ══════════════════════════════════════════════ */
    /* ⭐ v8: tryRace — بالتوازي                       */
    /* ══════════════════════════════════════════════ */
    async function tryRace(attempts, fileLabel, totalTimeoutMs) {
        toast('fa-spinner', '⚡ ' + fileLabel + ' — رفع متوازي (' + attempts.length + ' خدمات)...');

        var wrapped = attempts.map(function (a) {
            return a.fn().then(function (url) {
                if (!url) throw new Error(a.name + ': empty');
                return { url: url, service: a.name };
            });
        });

        // نغلّف الـ race بـ timeout عام
        var timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () {
                reject(new Error('انتهت المهلة (' + Math.round(totalTimeoutMs / 1000) + 'ث)'));
            }, totalTimeoutMs);
        });

        try {
            var winner = await Promise.race([
                promiseAny(wrapped),
                timeoutPromise
            ]);
            toast('fa-check', '✅ تم عبر ' + winner.service);
            return winner.url;
        } catch (e) {
            // اجمع كل الأخطاء
            var errors = (e.errors || []).map(function (err) {
                return err.message || 'خطأ';
            });
            var msg = errors.length > 0
                ? errors.join(' | ')
                : (e.message || 'فشل كل الرفع');
            throw new Error(msg);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Public: uploadImage / Audio / Video            */
    /* ══════════════════════════════════════════════ */
    async function uploadImage(file) {
        var imgFile = file;
        if (needsConversion(file)) {
            try {
                toast('fa-spinner', '⏳ تحويل الصيغة...');
                imgFile = await convertImageToJpg(file, 1920, 0.88);
            } catch (e) {
                console.warn('⚠️ conversion failed:', e);
            }
        }
        // ⭐ الصور: تسلسلي (imgbb سريع جداً)
        return await tryChain([
            { name: 'imgbb',    fn: function () { return uploadImgbb(imgFile); } },
            { name: '0x0.st',   fn: function () { return upload0x0(imgFile); } },
            { name: 'telegram', fn: function () { return uploadTelegramDocument(imgFile); } }
        ], 'صورة');
    }

    /* ⭐ v8: الصوت — Race بالتوازي */
    async function uploadAudio(file) {
        return await tryRace([
            { name: 'telegram',   fn: function () { return uploadTelegramAudio(file); } },
            { name: '0x0.st',     fn: function () { return upload0x0(file); } },
            { name: 'catbox.moe', fn: function () { return uploadCatbox(file); } }
        ], 'صوت', AUDIO_RACE_TIMEOUT_MS);
    }

    async function uploadVideo(file) {
        return await tryChain([
            { name: 'telegram', fn: function () { return uploadTelegramVideo(file); } }
        ], 'فيديو');
    }

    async function upload(file, options) {
        options = options || {};
        if (!file) throw new Error('لا يوجد ملف');

        if (file.size / (1024 * 1024) > 100) {
            throw new Error('الملف كبير جداً (الحد 100MB)');
        }

        var type = file.type || '';
        if (type.indexOf('image/') === 0) return await uploadImage(file);
        if (type.indexOf('audio/') === 0) return await uploadAudio(file);
        if (type.indexOf('video/') === 0) return await uploadVideo(file);
        return await uploadTelegramDocument(file);
    }

    /* ══════════════════════════════════════════════ */
    /* Exports                                        */
    /* ══════════════════════════════════════════════ */
    window.UploadService = {
        upload: upload,
        uploadImage: uploadImage,
        uploadAudio: uploadAudio,
        uploadVideo: uploadVideo,
        uploadTelegram: uploadTelegramDocument,
        uploadTelegramDocument: uploadTelegramDocument,
        uploadTelegramAudio: uploadTelegramAudio,
        uploadTelegramVideo: uploadTelegramVideo,
        uploadImgbb: uploadImgbb,
        uploadCatbox: uploadCatbox,
        upload0x0: upload0x0,
        getLastMeta: function () { return _lastMeta; },
        clearLastMeta: function () { _lastMeta = null; },
        convertImageToJpg: convertImageToJpg,
        needsConversion: needsConversion,
        uploadUguu: function (f) { return uploadTelegramDocument(f); },
        uploadTmpfiles: function (f) { return uploadTelegramDocument(f); },
        uploadGofile: function (f) { return uploadTelegramDocument(f); },
        uploadBashupload: function (f) { return uploadTelegramDocument(f); },
        uploadLitterbox: function (f) { return uploadTelegramDocument(f); },
        version: 8
    };

    console.log('📤 uploader.js v8 loaded — parallel race for audio (fast!)');
})();
