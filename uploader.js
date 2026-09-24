// ==============================================
// uploader.js v1 — رفع موحّد (اسم جديد لتجاوز الكاش)
// ==============================================

(function () {
    'use strict';
    if (window.__uploadServiceV3) return;
    window.__uploadServiceV3 = true;

    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';

    /* tmpfiles.org */
    async function uploadTmpfiles(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('tmpfiles HTTP ' + res.status);
        var data = await res.json();
        if (!data || !data.data || !data.data.url) throw new Error('tmpfiles: bad response');
        return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }

    /* gofile.io */
    async function uploadGofile(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetch('https://upload.gofile.io/uploadfile', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('gofile HTTP ' + res.status);
        var data = await res.json();
        if (!data || data.status !== 'ok' || !data.data || !data.data.downloadPage) throw new Error('gofile: bad response');
        return data.data.downloadPage;
    }

    /* bashupload.com */
    async function uploadBashupload(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetch('https://bashupload.com/', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('bashupload HTTP ' + res.status);
        var text = (await res.text()).trim();
        var match = text.match(/https:\/\/bashupload\.com\/[^\s]+/);
        if (!match) throw new Error('bashupload: no url');
        return match[0].replace('bashupload.com', 'bashupload.com/dl');
    }

    /* 0x0.st */
    async function upload0x0(file) {
        var fd = new FormData();
        fd.append('file', file);
        var res = await fetch('https://0x0.st', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('0x0 HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) throw new Error('0x0: ' + text.substring(0, 50));
        return text;
    }

    /* uguu.se */
    async function uploadUguu(file) {
        var fd = new FormData();
        fd.append('files[]', file);
        var res = await fetch('https://uguu.se/upload?output=text', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('uguu HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) throw new Error('uguu: bad');
        return text;
    }

    /* catbox.moe */
    async function uploadCatbox(file) {
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('fileToUpload', file);
        var res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('catbox HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) throw new Error('catbox: bad');
        return text;
    }

    /* litterbox */
    async function uploadLitterbox(file, hours) {
        hours = hours || 24;
        var time = hours <= 12 ? '12h' : (hours <= 24 ? '24h' : '72h');
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('time', time);
        fd.append('fileToUpload', file);
        var res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('litterbox HTTP ' + res.status);
        var text = (await res.text()).trim();
        if (!text || text.indexOf('https://') !== 0) throw new Error('litterbox: bad');
        return text;
    }

    /* imgbb */
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

    async function tryChain(attempts) {
        var errors = [];
        for (var i = 0; i < attempts.length; i++) {
            try {
                console.log('📤 Trying: ' + attempts[i].name + '...');
                var url = await attempts[i].fn();
                console.log('✅ Success: ' + attempts[i].name + ' →', url);
                return { url: url, service: attempts[i].name };
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
        var isVideo = type.indexOf('video/') === 0;
        var isAudio = type.indexOf('audio/') === 0;
        var isImage = type.indexOf('image/') === 0;

        if (isImage) {
            var imgFile = file;
            if (needsConversion(file)) {
                try { imgFile = await convertImageToJpg(file, 1920, 0.88); } catch (e) {}
            }
            return (await tryChain([
                { name: 'imgbb',    fn: function() { return uploadImgbb(imgFile); } },
                { name: 'tmpfiles', fn: function() { return uploadTmpfiles(imgFile); } }
            ])).url;
        }

        if (isVideo) {
            return (await tryChain([
                { name: 'tmpfiles',   fn: function() { return uploadTmpfiles(file); } },
                { name: 'gofile',     fn: function() { return uploadGofile(file); } },
                { name: 'bashupload', fn: function() { return uploadBashupload(file); } },
                { name: '0x0.st',     fn: function() { return upload0x0(file); } },
                { name: 'uguu.se',    fn: function() { return uploadUguu(file); } },
                { name: 'catbox',     fn: function() { return uploadCatbox(file); } },
                { name: 'litterbox',  fn: function() { return uploadLitterbox(file, 24); } }
            ])).url;
        }

        if (isAudio) {
            return (await tryChain([
                { name: 'tmpfiles',   fn: function() { return uploadTmpfiles(file); } },
                { name: 'gofile',     fn: function() { return uploadGofile(file); } },
                { name: 'bashupload', fn: function() { return uploadBashupload(file); } },
                { name: '0x0.st',     fn: function() { return upload0x0(file); } },
                { name: 'catbox',     fn: function() { return uploadCatbox(file); } },
                { name: 'uguu.se',    fn: function() { return uploadUguu(file); } }
            ])).url;
        }

        throw new Error('نوع غير مدعوم: ' + type);
    }

    window.UploadService = {
        upload: upload,
        uploadTmpfiles: uploadTmpfiles,
        uploadGofile: uploadGofile,
        uploadBashupload: uploadBashupload,
        upload0x0: upload0x0,
        uploadUguu: uploadUguu,
        uploadCatbox: uploadCatbox,
        uploadLitterbox: uploadLitterbox,
        uploadImgbb: uploadImgbb,
        version: 'v3-new'
    };

    console.log('📤 uploader.js v3 loaded — tmpfiles + gofile + bashupload');
})();
