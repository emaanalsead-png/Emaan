// ==============================================
// sw.js v37 — Stale-While-Revalidate + Persistent Cache
// ==============================================
// ✅ v37:
//   1. CACHE_NAME ثابت (بدل Date.now)
//   2. Stale-While-Revalidate للـ HTML/CSS/JS
//      → يحمّل من الكاش فوراً + يحدّث في الخلفية
//   3. Cache-First للصور
//   4. تحسين تنظيف الكاشات القديمة
// ==============================================

const CACHE_NAME = 'qamar-static-v37';
const CACHE_VERSION = 37;

// ⭐ Stale-While-Revalidate
const SWR_EXTENSIONS = ['.html', '.css', '.js', 'manifest.json'];
// ⭐ Cache-First
const CACHE_FIRST_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.ttf'];

self.addEventListener('install', function (e) {
    console.log('🔧 SW v37 installing...');
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log('✅ Cache opened:', CACHE_NAME);
            return Promise.resolve();
        })
    );
});

self.addEventListener('activate', function (e) {
    console.log('🚀 SW v37 activating...');
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) {
                    // احذف كل الكاشات القديمة
                    return k !== CACHE_NAME && (k.indexOf('qamar') === 0);
                }).map(function (k) {
                    console.log('🗑️ Deleting old cache:', k);
                    return caches.delete(k);
                })
            );
        }).then(function () {
            console.log('✅ Old caches cleared');
            return self.clients.claim();
        }).then(function () {
            return self.clients.matchAll({ type: 'window' }).then(function (clients) {
                clients.forEach(function (client) {
                    client.postMessage({ type: 'SW_UPDATED', version: 'v37' });
                });
            });
        })
    );
});

self.addEventListener('fetch', function (e) {
    var url = e.request.url;

    // ⭐ تجاهل Firebase و Google APIs و CDNs
    if (url.includes('firebaseio.com') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        url.includes('imgbb.com') ||
        url.includes('ui-avatars.com') ||
        url.includes('jsdelivr.net') ||
        url.includes('cloudflare.com') ||
        url.includes('unsplash.com') ||
        url.includes('github.com') ||
        url.includes('githubusercontent.com')) {
        return;
    }

    // فقط GET
    if (e.request.method !== 'GET') return;

    var urlLower = url.toLowerCase();
    var isSWR = SWR_EXTENSIONS.some(function (ext) { return urlLower.includes(ext); });

    if (isSWR) {
        // ⭐⭐⭐ Stale-While-Revalidate
        // المستخدم يرى النسخة المحفوظة فوراً + يُحدَّث في الخلفية
        e.respondWith(
            caches.open(CACHE_NAME).then(function (cache) {
                return cache.match(e.request).then(function (cached) {
                    var fetchPromise = fetch(e.request).then(function (response) {
                        if (response && response.status === 200 && response.type === 'basic') {
                            cache.put(e.request, response.clone());
                        }
                        return response;
                    }).catch(function () {
                        return cached;
                    });
                    // ⭐ أعط الكاش فوراً إن موجود، وإلا انتظر الشبكة
                    return cached || fetchPromise;
                });
            })
        );
    } else {
        // ⭐ Cache-First للصور والخطوط
        e.respondWith(
            caches.match(e.request).then(function (cached) {
                if (cached) return cached;
                return fetch(e.request).then(function (response) {
                    if (response && response.status === 200 && response.type === 'basic') {
                        var clone = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(e.request, clone);
                        });
                    }
                    return response;
                });
            })
        );
    }
});

self.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
