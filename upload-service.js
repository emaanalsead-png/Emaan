// ==============================================
// upload-service.js v2 — رفع موحّد مع بدائل
// ==============================================
// ✅ v2 (فوق v1):
//   1. catbox → 0x0.st → uguu.se (fallback chain)
//   2. litterbox → 0x0.st → uguu.se
//   3. تشخيص واضح لكل خدمة
//   4. صور: imgbb → 0x0.st (fallback)
// ==============================================

(function () {
    'use strict';
    if (window.__uploadServiceV2) return;
    window.__uploadServiceV2 = true;

    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';

    /* ════════ 0x0.st — موثوق (512MB, 30 يوم) ════════ */
    async function upload0x0(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetch('https://0x0.st', {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error('0x0 HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('0x0: ' + text.substring(0, 100));
        }
        return text;
    }

    /* ════════ uguu.se — بديل سريع (128MB, 3h) ════════ */
    async function uploadUguu(file) {
        var fd = new FormData();
        fd.append('files[]', file);
        var res = await fetch('https://uguu.se/upload?output=text', {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error('uguu HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('uguu: ' + text.substring(0, 100));
        }
        return text;
    }

    /* ════════ catbox.moe — دائم (200MB) ════════ */
    async function uploadCatbox(file) {
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('fileToUpload', file);
        var res = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error('catbox HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) {
            throw new Error('catbox: ' + text.substring(0, 100));
        }
        return text;
    }

    /* ════════ litterbox — مؤقت (1GB, 24h) ════════ */
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

    /* ════════ imgbb — صور ════════ */
    async function uploadImgbb(file) {
        var fd = new FormData();
        fd.append('key', IMGBB_KEY);
        fd.append('image', file);
        var res = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: fd
        });
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
                        if (w > h) {
                            if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
                        } else {
                            if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
                        }
                        canvas.width = w;
                        canvas.height = h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        canvas.toBlob(function (blob) {
                            if (!blob) { reject(new Error('convert failed')); return; }
                            var newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
                            var newFile = new File([blob], newName, { type: 'image/jpeg' });
                            resolve(newFile);
                        }, 'image/jpeg', quality);
                    } catch (err) { reject(err); }
                };
                img.onerror = function () { reject(new Error('image load failed')); };
                img.src = e.target.result;
            };
            reader.onerror = function () { reject(new Error('file read failed')); };
            reader.readAsDataURL(file);
        });
    }

    function needsConversion(file) {
        if (!file || !file.type) return false;
        var needConvert = [
            'image/heic', 'image/heif', 'image/avif',
            'image/tiff', 'image/bmp'
        ];
        return needConvert.indexOf(file.type) !== -1;
    }

    /* ════════ سلسلة fallback ════════ */
    async function tryChain(attempts) {
        var errors = [];
        for (var i = 0; i < attempts.length; i++) {
            var name = attempts[i].name;
            var fn = attempts[i].fn;
            try {
                console.log('📤 Trying: ' + name + '...');
                var url = await fn();
                console.log('✅ Success: ' + name + ' →', url);
                return { url: url, service: name };
            } catch (e) {
                console.warn('❌ Failed: ' + name + ' →', e.message);
                errors.push(name + ': ' + e.message);
            }
        }
        throw new Error('كل الخدمات فشلت:\n' + errors.join('\n'));
    }

    /* ════════ الرفع الموحّد ════════ */
    async function upload(file, options) {
        options = options || {};
        if (!file) throw new Error('لا يوجد ملف');

        var type = file.type || '';
        var isVideo = type.indexOf('video/') === 0;
        var isAudio = type.indexOf('audio/') === 0;
        var isImage = type.indexOf('image/') === 0;

        /* ─── صور ─── */
        if (isImage) {
            var imgFile = file;
            if (needsConversion(file)) {
                try {
                    imgFile = await convertImageToJpg(file, 1920, 0.88);
                } catch (e) {
                    console.warn('⚠️ conversion failed:', e);
                }
            }
            // imgbb → 0x0
            return (await tryChain([
                { name: 'imgbb', fn: function() { return uploadImgbb(imgFile); } },
                { name: '0x0.st', fn: function() { return upload0x0(imgFile); } }
            ])).url;
        }

        /* ─── فيديو ─── */
        if (isVideo) {
            // ترتيب: 0x0 (30 يوم) → uguu (3h) → catbox → litterbox
            return (await tryChain([
                { name: '0x0.st',  fn: function() { return upload0x0(file); } },
                { name: 'uguu.se', fn: function() { return uploadUguu(file); } },
                { name: 'catbox',  fn: function() { return uploadCatbox(file); } },
                { name: 'litterbox', fn: function() { return uploadLitterbox(file, options.hours || 24); } }
            ])).url;
        }

        /* ─── صوت ─── */
        if (isAudio) {
            return (await tryChain([
                { name: '0x0.st',  fn: function() { return upload0x0(file); } },
                { name: 'catbox',  fn: function() { return uploadCatbox(file); } },
                { name: 'uguu.se', fn: function() { return uploadUguu(file); } }
            ])).url;
        }

        throw new Error('نوع غير مدعوم: ' + type);
    }

    /* ════════ التصدير ════════ */
    window.UploadService = {
        upload: upload,
        upload0x0: upload0x0,
        uploadUguu: uploadUguu,
        uploadCatbox: uploadCatbox,
        uploadLitterbox: uploadLitterbox,
        uploadImgbb: uploadImgbb,
        convertImageToJpg: convertImageToJpg,
        needsConversion: needsConversion,
        version: 2
    };

    console.log('📤 upload-service.js v2 loaded — 0x0.st + uguu.se + catbox + imgbb');
})();
