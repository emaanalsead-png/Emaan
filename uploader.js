// ==============================================
// uploader.js v4 — Telegram Upload (يعمل في سوريا)
// ==============================================

(function () {
    'use strict';
    if (window.__uploadServiceV4) return;
    window.__uploadServiceV4 = true;

    // 🔑 بيانات البوت
    var TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    var TG_CHAT_ID = '-1003978647266';
    var TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;

    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';

    /* ════════ Telegram — رفع شامل ════════ */
    async function uploadTelegram(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('document', file);

        var res = await fetch(TG_API + '/sendDocument', {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error('telegram HTTP ' + res.status);

        var data = await res.json();
        if (!data.ok || !data.result || !data.result.document) {
            throw new Error('telegram: ' + (data.description || 'bad response'));
        }

        var fileId = data.result.document.file_id;

        // نجيب file_path
        var fileRes = await fetch(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId));
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('telegram getFile failed');
        }

        // الرابط المباشر
        var url = 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
        return url;
    }

    /* ════════ imgbb — صور ════════ */
    async function uploadImgbb(file) {
        var fd = new FormData();
        fd.append('key', IMGBB_KEY);
        fd.append('image', file);
        var res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
        var data = await res.json();
        if (!data.success || !data.data || !data.data.url) {
            throw new Error('imgbb: ' + (data.error && data.error.message || 'unknown'));
        }
        return data.data.url;
    }

    /* ════════ تحويل صورة إلى JPG ════════ */
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
                            var newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
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
        return ['image/heic','image/heif','image/avif','image/tiff','image/bmp'].indexOf(file.type) !== -1;
    }

    async function tryChain(attempts) {
        var errors = [];
        for (var i = 0; i < attempts.length; i++) {
            try {
                console.log('📤 Trying: ' + attempts[i].name + '...');
                var url = await attempts[i].fn();
                console.log('✅ Success: ' + attempts[i].name);
                return url;
            } catch (e) {
                console.warn('❌ Failed: ' + attempts[i].name + ' →', e.message);
                errors.push(attempts[i].name + ': ' + e.message);
            }
        }
        throw new Error(errors.join(' | '));
    }

    async function upload(file, options) {
        options = options || {};
        if (!file) throw new Error('لا يوجد ملف');

        var type = file.type || '';
        var isImage = type.indexOf('image/') === 0;

        // صور → imgbb أولاً، ثم تلغرام كبديل
        if (isImage) {
            var imgFile = file;
            if (needsConversion(file)) {
                try { imgFile = await convertImageToJpg(file, 1920, 0.88); } catch (e) {}
            }
            return await tryChain([
                { name: 'imgbb',    fn: function() { return uploadImgbb(imgFile); } },
                { name: 'telegram', fn: function() { return uploadTelegram(imgFile); } }
            ]);
        }

        // فيديو + صوت → تلغرام (يعمل في سوريا)
        return await tryChain([
            { name: 'telegram', fn: function() { return uploadTelegram(file); } }
        ]);
    }

    window.UploadService = {
        upload: upload,
        uploadTelegram: uploadTelegram,
        uploadImgbb: uploadImgbb,
        version: 'v4-telegram'
    };

    console.log('📤 uploader.js v4 loaded — TELEGRAM (works in Syria)');
})();
