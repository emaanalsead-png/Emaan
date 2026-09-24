// ==============================================
// uploader.js v6 — حل شامل (صورة + صوت + فيديو)
// ==============================================
// ✅ v6:
//   1. حل مشكلة الموسيقى: catbox → 0x0.st → تلغرام (sendAudio)
//   2. الصورة: imgbb → 0x0.st → تلغرام (sendDocument)
//   3. الفيديو: تلغرام (sendVideo) → litterbox → catbox
//   4. تحويل HEIC/HEIF/AVIF/TIFF/BMP إلى JPG
//   5. Aliases كاملة للتوافق مع الكود القديم
// ==============================================

(function () {
    'use strict';
    if (window.__uploadServiceV6) return;
    window.__uploadServiceV6 = true;

    var TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    var TG_CHAT_ID = '-1003978647266';
    var TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;
    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';

    /* ══════════════════════════════════════════════ */
    /* تلغرام — sendDocument (عام)                    */
    /* ══════════════════════════════════════════════ */
    async function uploadTelegramDocument(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('document', file);
        var res = await fetch(TG_API + '/sendDocument', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('tg doc HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result || !data.result.document) {
            throw new Error('tg doc: ' + (data.description || 'bad'));
        }
        var fileId = data.result.document.file_id;
        var fileRes = await fetch(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId));
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('tg getFile failed');
        }
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

    /* ══════════════════════════════════════════════ */
    /* تلغرام — sendAudio (للموسيقى)                  */
    /* ══════════════════════════════════════════════ */
    async function uploadTelegramAudio(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('audio', file);
        var res = await fetch(TG_API + '/sendAudio', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('tg audio HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result) {
            throw new Error('tg audio: ' + (data.description || 'bad'));
        }
        var fileId = null;
        if (data.result.audio && data.result.audio.file_id) fileId = data.result.audio.file_id;
        else if (data.result.document && data.result.document.file_id) fileId = data.result.document.file_id;
        else if (data.result.voice && data.result.voice.file_id) fileId = data.result.voice.file_id;
        if (!fileId) throw new Error('tg audio: no file_id');
        var fileRes = await fetch(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId));
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('tg getFile failed');
        }
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

    /* ══════════════════════════════════════════════ */
    /* تلغرام — sendVideo (للفيديو)                   */
    /* ══════════════════════════════════════════════ */
    async function uploadTelegramVideo(file) {
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('video', file);
        fd.append('supports_streaming', 'true');
        var res = await fetch(TG_API + '/sendVideo', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('tg video HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result) {
            throw new Error('tg video: ' + (data.description || 'bad'));
        }
        var fileId = null;
        if (data.result.video && data.result.video.file_id) fileId = data.result.video.file_id;
        else if (data.result.animation && data.result.animation.file_id) fileId = data.result.animation.file_id;
        else if (data.result.document && data.result.document.file_id) fileId = data.result.document.file_id;
        if (!fileId) throw new Error('tg video: no file_id');
        var fileRes = await fetch(TG_API + '/getFile?file_id=' + encodeURIComponent(fileId));
        var fileData = await fileRes.json();
        if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
            throw new Error('tg getFile failed');
        }
        return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + fileData.result.file_path;
    }

    /* ══════════════════════════════════════════════ */
    /* catbox.moe — للصوت (دائم)                      */
    /* ══════════════════════════════════════════════ */
    async function uploadCatbox(file) {
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('fileToUpload', file);
        var res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('catbox HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('catbox: ' + text.substring(0, 100));
        }
        return text;
    }

    /* ══════════════════════════════════════════════ */
    /* 0x0.st — للملفات الصغيرة (30 يوم)              */
    /* ══════════════════════════════════════════════ */
    async function upload0x0(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetch('https://0x0.st', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('0x0 HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('0x0: ' + text.substring(0, 100));
        }
        return text;
    }

    /* ══════════════════════════════════════════════ */
    /* litterbox — للفيديو المؤقت (24h مع الحالة)     */
    /* ══════════════════════════════════════════════ */
    async function uploadLitterbox(file, hours) {
        hours = hours || 24;
        var time = hours <= 1 ? '1h' :
                   hours <= 12 ? '12h' :
                   hours <= 24 ? '24h' : '72h';
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('time', time);
        fd.append('fileToUpload', file);
        var res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error('litterbox HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('litterbox: ' + text.substring(0, 100));
        }
        return text;
    }

    /* ══════════════════════════════════════════════ */
    /* imgbb — للصور                                  */
    /* ══════════════════════════════════════════════ */
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

    /* ══════════════════════════════════════════════ */
    /* تحويل الصور الحديثة إلى JPG                    */
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
    /* Chain helper — يجرب بالترتيب                   */
    /* ══════════════════════════════════════════════ */
    async function tryChain(attempts) {
        var errors = [];
        for (var i = 0; i < attempts.length; i++) {
            var name = attempts[i].name;
            var fn = attempts[i].fn;
            try {
                console.log('📤 Trying: ' + name + '...');
                var url = await fn();
                console.log('✅ Success: ' + name);
                return url;
            } catch (e) {
                console.warn('❌ Failed: ' + name + ' →', e.message);
                errors.push(name + ': ' + e.message);
            }
        }
        throw new Error('كل الخدمات فشلت:\n' + errors.join('\n'));
    }

    /* ══════════════════════════════════════════════ */
    /* الصورة — imgbb → 0x0 → تلغرام                  */
    /* ══════════════════════════════════════════════ */
    async function uploadImage(file) {
        var imgFile = file;
        if (needsConversion(file)) {
            try { imgFile = await convertImageToJpg(file, 1920, 0.88); }
            catch (e) { console.warn('⚠️ conversion failed:', e); }
        }
        return await tryChain([
            { name: 'imgbb', fn: function () { return uploadImgbb(imgFile); } },
            { name: '0x0.st', fn: function () { return upload0x0(imgFile); } },
            { name: 'telegram', fn: function () { return uploadTelegramDocument(imgFile); } }
        ]);
    }

    /* ══════════════════════════════════════════════ */
    /* الصوت — catbox → 0x0 → تلغرام                  */
    /* ══════════════════════════════════════════════ */
    async function uploadAudio(file) {
        return await tryChain([
            { name: 'catbox.moe', fn: function () { return uploadCatbox(file); } },
            { name: '0x0.st', fn: function () { return upload0x0(file); } },
            { name: 'telegram-audio', fn: function () { return uploadTelegramAudio(file); } }
        ]);
    }

    /* ══════════════════════════════════════════════ */
    /* الفيديو — تلغرام → litterbox → catbox          */
    /* ══════════════════════════════════════════════ */
    async function uploadVideo(file, options) {
        options = options || {};
        var hours = options.hours || 24;
        return await tryChain([
            { name: 'telegram-video', fn: function () { return uploadTelegramVideo(file); } },
            { name: 'litterbox', fn: function () { return uploadLitterbox(file, hours); } },
            { name: 'catbox.moe', fn: function () { return uploadCatbox(file); } }
        ]);
    }

    /* ══════════════════════════════════════════════ */
    /* upload — الدالة الموحدة                        */
    /* ══════════════════════════════════════════════ */
    async function upload(file, options) {
        options = options || {};
        if (!file) throw new Error('لا يوجد ملف');
        var type = file.type || '';
        if (type.indexOf('image/') === 0) return await uploadImage(file);
        if (type.indexOf('audio/') === 0) return await uploadAudio(file);
        if (type.indexOf('video/') === 0) return await uploadVideo(file, options);
        // نوع آخر → تلغرام document
        return await uploadTelegramDocument(file);
    }

    /* ══════════════════════════════════════════════ */
    /* التصدير + Aliases                              */
    /* ══════════════════════════════════════════════ */
    window.UploadService = {
        // الدالة الموحدة
        upload: upload,
        // الدوال الأساسية
        uploadImage: uploadImage,
        uploadAudio: uploadAudio,
        uploadVideo: uploadVideo,
        // خدمات مباشرة
        uploadTelegram: uploadTelegramDocument,
        uploadTelegramDocument: uploadTelegramDocument,
        uploadTelegramAudio: uploadTelegramAudio,
        uploadTelegramVideo: uploadTelegramVideo,
        uploadImgbb: uploadImgbb,
        uploadCatbox: uploadCatbox,
        uploadLitterbox: uploadLitterbox,
        upload0x0: upload0x0,
        // أدوات
        convertImageToJpg: convertImageToJpg,
        needsConversion: needsConversion,
        // Aliases للتوافق مع الكود القديم
        uploadUguu: function (file) { return uploadTelegramDocument(file); },
        uploadTmpfiles: function (file) { return uploadTelegramDocument(file); },
        uploadGofile: function (file) { return uploadTelegramDocument(file); },
        uploadBashupload: function (file) { return uploadTelegramDocument(file); },
        version: 6
    };

    console.log('📤 uploader.js v6 loaded — image+audio+video | catbox+0x0+imgbb+telegram+litterbox');
})();
