// ==============================================
// connection-resilience.js v1
// ==============================================
// ✅ الهدف:
//   1. شريط بصري "جاري إعادة الاتصال..."
//   2. تعطيل toasts المزعجة أثناء الانقطاع
//   3. كتابة "online" فوراً عند العودة
//   4. flag عام __qamarOffline للاستخدام في باقي الكود
// ==============================================

(function () {
    'use strict';
    if (window.__connectionResilienceV1) return;
    window.__connectionResilienceV1 = true;

    var RECONNECT_DELAY = 1500; // انتظر 1.5s قبل اعتبار الاتصال مستقراً
    var _wasDisconnected = false;
    var _reconnectTimer = null;
    var _bannerEl = null;
    var _offlineSince = 0;

    // ⭐ flag عام يستخدمه باقي الكود
    window.__qamarOffline = false;

    /* ══════════════════════════════════════════════ */
    /* Banner                                          */
    /* ══════════════════════════════════════════════ */
    function _createBanner() {
        if (document.getElementById('qamar-offline-banner')) return;
        var b = document.createElement('div');
        b.id = 'qamar-offline-banner';
        b.style.cssText = [
            'position: fixed',
            'top: 0', 'left: 0', 'right: 0',
            'background: linear-gradient(90deg, #b00020, #ff4444, #b00020)',
            'color: #fff',
            'text-align: center',
            'padding: 8px 12px',
            'font-family: Cairo, sans-serif',
            'font-size: 12px',
            'font-weight: 900',
            'z-index: 9999998',
            'display: none',
            'box-shadow: 0 2px 10px rgba(0,0,0,0.6)',
            'direction: rtl',
            'transform: translateY(-100%)',
            'transition: transform 0.3s ease',
            'pointer-events: none',
            'padding-top: calc(8px + env(safe-area-inset-top, 0px))'
        ].join(';');
        b.innerHTML = '<span id="qamar-offline-text">🔴 جاري إعادة الاتصال...</span>';
        document.body.appendChild(b);
        _bannerEl = b;
    }

    function _showBanner(text) {
        if (!_bannerEl) _createBanner();
        if (!_bannerEl) return;
        var txt = document.getElementById('qamar-offline-text');
        if (txt && text) txt.textContent = text;
        _bannerEl.style.display = 'block';
        requestAnimationFrame(function () {
            _bannerEl.style.transform = 'translateY(0)';
        });
    }

    function _hideBanner() {
        if (!_bannerEl) return;
        _bannerEl.style.transform = 'translateY(-100%)';
        setTimeout(function () {
            if (_bannerEl) _bannerEl.style.display = 'none';
        }, 350);
    }

    /* ══════════════════════════════════════════════ */
    /* Suppress toasts أثناء الانقطاع                  */
    /* ══════════════════════════════════════════════ */
    function _hookToast() {
        if (typeof window.showToast !== 'function') return false;
        if (window.showToast.__resilienceWrapped) return true;

        var _origToast = window.showToast;
        window.showToast = function (icon, msg, duration) {
            if (window.__qamarOffline) {
                console.log('⏭️ Toast suppressed (offline):', msg);
                return;
            }
            return _origToast.call(this, icon, msg, duration);
        };
        window.showToast.__resilienceWrapped = true;
        return true;
    }

    /* ══════════════════════════════════════════════ */
    /* كتابة "online" فوراً عند العودة                  */
    /* ══════════════════════════════════════════════ */
    function _writeOnlineNow() {
        try {
            var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!u || !u.uid) return;
            if (typeof db === 'undefined' || !db) return;
            var room = 'general';
            try {
                if (typeof ChatState !== 'undefined' && ChatState.currentRoom) {
                    room = ChatState.currentRoom;
                }
            } catch (e) {}
            db.ref('user_presence/' + u.uid).set({
                state: 'online',
                lastChanged: Date.now(),
                room: room
            }).catch(function () {});
        } catch (e) {}
    }

    /* ══════════════════════════════════════════════ */
    /* Monitor                                         */
    /* ══════════════════════════════════════════════ */
    function _initMonitor() {
        if (typeof db === 'undefined' || !db) {
            setTimeout(_initMonitor, 500);
            return;
        }

        // hook للـ toast
        var toastInterval = setInterval(function () {
            if (_hookToast()) clearInterval(toastInterval);
        }, 300);
        setTimeout(function () { clearInterval(toastInterval); }, 10000);

        var connectedRef = db.ref('.info/connected');
        connectedRef.on('value', function (snap) {
            var connected = snap.val() === true;

            if (connected) {
                if (_wasDisconnected) {
                    var offlineDuration = Date.now() - _offlineSince;
                    console.log('🟢 Reconnected after ' + Math.round(offlineDuration / 1000) + 's');
                    _showBanner('🟢 تم الاتصال — جاري المزامنة...');

                    // ⭐ اكتب online فوراً
                    _writeOnlineNow();

                    clearTimeout(_reconnectTimer);
                    _reconnectTimer = setTimeout(function () {
                        window.__qamarOffline = false;
                        _hideBanner();
                        _wasDisconnected = false;
                        console.log('✅ Connection stable');
                    }, RECONNECT_DELAY);
                } else {
                    // أول اتصال
                    _hideBanner();
                }
            } else {
                if (!_wasDisconnected) {
                    _offlineSince = Date.now();
                    console.log('🔴 Network disconnected');
                    window.__qamarOffline = true;
                    _showBanner('🔴 جاري إعادة الاتصال...');
                    _wasDisconnected = true;
                }
            }
        });

        console.log('✅ connection-resilience: monitor active');
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                            */
    /* ══════════════════════════════════════════════ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(_initMonitor, 1500);
        });
    } else {
        setTimeout(_initMonitor, 1500);
    }

    console.log('📦 connection-resilience.js v1 loaded');
})();
