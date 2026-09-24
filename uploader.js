// ==============================================
// uploader.js v5 — Telegram + aliases
// ==============================================

(function () {
    'use strict';
    if (window.__uploadServiceV5) return;
    window.__uploadServiceV5 = true;

    var TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    var TG_CHAT_ID = '-1003978647266';
    var TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;
    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';

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

        var fileRes = await fetch(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId));
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('telegram getFile failed');
        }
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

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

    async function upload(file, options) {
        options = options || {};
        if (!file) throw new Error('لا يوجد ملف');
        var type = file.type || '';
        var isImage = type.indexOf('image/') === 0;

        if (isImage) {
            var imgFile = file;
            if (needsConversion(file)) {
                try { imgFile = await convertImageToJpg(file, 1920, 0.88); } catch (e) {}
            }
            try {
                console.log('📤 Trying: imgbb...');
                var url = await uploadImgbb(imgFile);
                console.log('✅ imgbb success');
                return url;
            } catch (e) {
                console.warn('❌ imgbb failed, trying telegram:', e.message);
                console.log('📤 Trying: telegram...');
                return await uploadTelegram(imgFile);
            }
        }

        console.log('📤 Trying: telegram...');
        return await uploadTelegram(file);
    }

    // ⭐ كل الأسماء القديمة تُوجَّه لتلغرام
    window.UploadService = {
        upload: upload,
        uploadTelegram: uploadTelegram,
        uploadImgbb: uploadImgbb,
        // aliases (ترجع لتلغرام)
        uploadLitterbox: function(file, hours) { return uploadTelegram(file); },
        uploadCatbox: function(file) { return uploadTelegram(file); },
        uploadTmpfiles: function(file) { return uploadTelegram(file); },
        uploadGofile: function(file) { return uploadTelegram(file); },
        uploadBashupload: function(file) { return uploadTelegram(file); },
        upload0x0: function(file) { return uploadTelegram(file); },
        uploadUguu: function(file) { return uploadTelegram(file); },
        convertImageToJpg: convertImageToJpg,
        needsConversion: needsConversion,
        version: 'v5-telegram-aliases'
    };

    console.log('📤 uploader.js v5 loaded — TELEGRAM + aliases');
})();
