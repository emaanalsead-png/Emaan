// ==============================================
// قمر الشام — خاص محسّن (v8)
// ==============================================
// ✅ v8 (فوق v7):
//   1. _isBlockedBetween: قراءتان بالتوازي (بدل تسلسلي)
//   2. loadPrivateMessages: deletedAt + blocked بالتوازي
//   3. mark-as-read: دفعة واحدة (بدل رسالة-رسالة)
//   4. clearPrivateNotifsFrom: limitToLast(30) بدل الكل
// ==============================================
// ✅ v7 (محفوظ):
//   1. زر 🚨 إبلاغ
//   2. زر 🚔 استدعاء السجان
//   3. حظر ثنائي مؤقت
//   4. زر 🗑️ حذف في قائمة المحادثات
//   5. صوت تحذير جديد
//   6. كل ميزات v6
// ==============================================

(function () {
    'use strict';
    if (window.__pmEnhancedV8) return;
    window.__pmEnhancedV8 = true;

    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';
    var PM = { replyingTo: null, lastSendAt: 0, openMenu: null };

    var REPORT_REASONS = [
        { id: 'abuse',   icon: '🚫', name: 'محتوى مسيء' },
        { id: 'promo',   icon: '📢', name: 'ترويج / إعلان' },
        { id: 'adult',   icon: '🔞', name: 'محتوى غير لائق' },
        { id: 'harass',  icon: '💢', name: 'تحرش / إزعاج' },
        { id: 'other',   icon: '❓', name: 'سبب آخر' }
    ];

    /* CSS */
    (function injectCSS() {
        if (document.getElementById('pm-enhanced-css')) return;
        var s = document.createElement('style');
        s.id = 'pm-enhanced-css';
        s.textContent = `
.pm-plus-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,215,0,0.35);
    color: #ffd700;
    cursor: pointer;
    font-size: 15px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
}
.pm-toolbar {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 10px;
    display: none;
    gap: 8px;
    padding: 10px;
    background: rgba(15,15,25,0.97);
    border: 1px solid rgba(255,215,0,0.5);
    border-radius: 15px;
    z-index: 100;
}
.pm-toolbar.open { display: flex; }
.pm-toolbar button {
    width: 42px; height: 42px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,215,0,0.35);
    color: #ffd700;
    cursor: pointer;
    font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
}
.pm-reply-preview {
    display: none;
    padding: 8px 34px 8px 12px;
    background: rgba(255,215,0,0.1);
    border-top: 1px solid rgba(255,215,0,0.3);
    border-right: 3px solid #ffd700;
    font-size: 12px;
    position: relative;
}
.pm-reply-preview.show { display: block; }
.pm-reply-preview .pm-reply-name { color: #ffd700; font-weight: 900; margin-bottom: 3px; font-size: 11px; }
.pm-reply-preview .pm-reply-text { color: #aaa; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-reply-preview .pm-reply-close { position: absolute; top: 6px; left: 10px; cursor: pointer; color: #ff6666; font-weight: 900; font-size: 14px; }

.pc-msg { position: relative !important; }
.pc-msg.sent { padding-left: 24px !important; padding-right: 4px !important; }
.pc-msg.received { padding-left: 4px !important; padding-right: 24px !important; }

.pc-msg-reply {
    padding: 4px 8px;
    border-right: 3px solid #ffd700;
    background: rgba(0,0,0,0.35);
    border-radius: 6px;
    font-size: 11px;
    margin-bottom: 4px;
    cursor: pointer;
}
.pc-msg-reply .rname { color: #ffd700; font-weight: 900; display: block; font-size: 10px; }
.pc-msg-reply .rtext { color: #aaa; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.pc-msg-attachment img,
.pc-msg-attachment video { max-width: 100%; max-height: 220px; border-radius: 10px; display: block; margin-top: 6px; cursor: pointer; }
.pc-msg-attachment audio { width: 100%; max-width: 220px; margin-top: 6px; }
.pc-msg-reactions { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.pc-reaction {
    background: rgba(255,215,0,0.18);
    border: 1px solid rgba(255,215,0,0.4);
    border-radius: 12px;
    padding: 1px 8px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
}
.pc-reaction.mine { background: rgba(255,215,0,0.5); border-color: #ffd700; }

.pc-msg-menu-btn {
    position: absolute !important;
    top: 4px !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 50% !important;
    background: rgba(0,0,0,0.6) !important;
    border: 1px solid rgba(255,255,255,0.25) !important;
    color: #fff !important;
    cursor: pointer !important;
    font-size: 12px !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    opacity: 0.6 !important;
    padding: 0 !important;
    line-height: 1 !important;
    z-index: 5 !important;
}
.pc-msg-menu-btn:active { opacity: 1 !important; }
.pc-msg.sent .pc-msg-menu-btn { left: 2px !important; right: auto !important; }
.pc-msg.received .pc-msg-menu-btn { right: 2px !important; left: auto !important; }

.pc-msg-menu {
    position: fixed !important;
    background: rgba(15,15,25,0.98) !important;
    border: 1px solid rgba(255,215,0,0.6) !important;
    border-radius: 12px !important;
    padding: 5px !important;
    z-index: 999999 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
    min-width: 150px !important;
    max-width: 200px !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.95) !important;
}
.pc-msg-menu-item {
    padding: 11px 14px !important;
    border-radius: 7px !important;
    color: #fff !important;
    font-size: 13px !important;
    cursor: pointer !important;
    font-weight: 700 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    white-space: nowrap !important;
    justify-content: flex-start !important;
}
.pc-msg-menu-item:active { background: rgba(255,215,0,0.25) !important; color: #ffd700 !important; }
.pc-msg-menu-item.danger { color: #ff7777 !important; }

.pc-emoji-bar {
    position: fixed !important;
    background: rgba(15,15,25,0.98) !important;
    border: 1px solid rgba(255,215,0,0.55) !important;
    border-radius: 15px !important;
    padding: 8px 12px !important;
    display: flex !important;
    gap: 10px !important;
    z-index: 999999 !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.95) !important;
}
.pc-emoji-bar span { font-size: 24px !important; cursor: pointer !important; }

.pm-chat-del-btn {
    width: 30px !important;
    height: 30px !important;
    border-radius: 50% !important;
    background: rgba(255,68,68,0.15) !important;
    border: 1px solid rgba(255,68,68,0.45) !important;
    color: #ff7777 !important;
    cursor: pointer !important;
    font-size: 13px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    flex-shrink: 0 !important;
    transition: all 0.15s ease !important;
}
.pm-chat-del-btn:active {
    background: rgba(255,68,68,0.35) !important;
    transform: scale(0.92) !important;
}

.pc-input-blocked {
    background: rgba(255,68,68,0.08) !important;
    border-color: rgba(255,68,68,0.4) !important;
    color: #ff9999 !important;
    cursor: not-allowed !important;
    font-style: italic;
}
        `;
        document.head.appendChild(s);
    })();

    function enhanceModal() {
        var modal = document.getElementById('private-chat-modal');
        if (!modal) return false;
        var inputArea = modal.querySelector('.private-chat-input');
        if (!inputArea) return false;

        if (!modal.querySelector('.pm-reply-preview')) {
            var prev = document.createElement('div');
            prev.className = 'pm-reply-preview';
            prev.id = 'pm-reply-preview';
            prev.innerHTML =
                '<span class="pm-reply-close" onclick="pmCancelReply()">✕</span>' +
                '<div class="pm-reply-name" id="pm-reply-name"></div>' +
                '<div class="pm-reply-text" id="pm-reply-text"></div>';
            inputArea.parentNode.insertBefore(prev, inputArea);
        }

        if (!modal.querySelector('.pm-toolbar')) {
            var tb = document.createElement('div');
            tb.className = 'pm-toolbar';
            tb.id = 'pm-toolbar';
            tb.innerHTML =
                '<button onclick="pmPickImage()" title="صورة"><i class="fas fa-image"></i></button>' +
                '<button onclick="pmPickVideo()" title="فيديو"><i class="fas fa-video"></i></button>' +
                '<button onclick="pmPickAudio()" title="صوت"><i class="fas fa-microphone"></i></button>' +
                '<button onclick="pmInsertEmoji()" title="إيموجي"><i class="fas fa-smile"></i></button>' +
                '<button onclick="pmDeleteAllMessages()" title="حذف الكل" style="background:rgba(255,68,68,0.2);color:#ff6666;"><i class="fas fa-trash"></i></button>';
            inputArea.parentNode.insertBefore(tb, inputArea);
        }

        if (!inputArea.querySelector('.pm-plus-btn')) {
            var plus = document.createElement('button');
            plus.className = 'pm-plus-btn';
            plus.innerHTML = '<i class="fas fa-plus"></i>';
            plus.onclick = function (e) { e.preventDefault(); pmToggleToolbar(); };
            inputArea.insertBefore(plus, inputArea.firstChild);
        }

        ['image', 'video', 'audio'].forEach(function (t) {
            var id = 'pm-file-' + t;
            if (document.getElementById(id)) return;
            var fi = document.createElement('input');
            fi.type = 'file';
            fi.id = id;
            fi.accept = t + '/*';
            fi.style.display = 'none';
            fi.onchange = function () { pmHandleFile(this.files[0], t); this.value = ''; };
            document.body.appendChild(fi);
        });

        return true;
    }

    /* ⭐ v8: قراءتان بالتوازي */
    async function _isBlockedBetween(uid1, uid2) {
        try {
            var results = await Promise.all([
                db.ref('user_private_blocks/' + uid1 + '/' + uid2).once('value')
                    .catch(function () { return null; }),
                db.ref('user_private_blocks/' + uid2 + '/' + uid1).once('value')
                    .catch(function () { return null; })
            ]);
            if (results[0] && results[0].exists()) return true;
            if (results[1] && results[1].exists()) return true;
        } catch (e) {}
        return false;
    }

    window.displayPrivateMsg = function (msg, isSent) {
        var c = document.getElementById('pc-messages');
        if (!c) return;

        var e = document.createElement('div');
        e.className = 'pc-msg ' + (isSent ? 'sent' : 'received');
        e.setAttribute('data-pm-msg', msg._key || '');

        if (msg.replyTo) {
            var rq = document.createElement('div');
            rq.className = 'pc-msg-reply';
            var rn = document.createElement('div');
            rn.className = 'rname';
            rn.textContent = '↩ ' + (msg.replyTo.senderName || '');
            var rt = document.createElement('div');
            rt.className = 'rtext';
            rt.textContent = msg.replyTo.text || '';
            rq.appendChild(rn);
            rq.appendChild(rt);
            rq.onclick = function () {
                var target = document.querySelector('[data-pm-msg="' + msg.replyTo.id + '"]');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.style.background = 'rgba(255,215,0,0.2)';
                    setTimeout(function () { target.style.background = ''; }, 1500);
                }
            };
            e.appendChild(rq);
        }

        if (msg.deleted) {
            var dt = document.createElement('div');
            dt.textContent = '🚫 محذوفة';
            dt.style.opacity = '0.5';
            dt.style.fontStyle = 'italic';
            e.appendChild(dt);
        } else if (msg.text) {
            var tt = document.createElement('div');
            tt.textContent = msg.text;
            e.appendChild(tt);
        }

        if (msg.attachment && msg.attachment.url && !msg.deleted) {
            var att = document.createElement('div');
            att.className = 'pc-msg-attachment';
            if (msg.attachment.type === 'image') {
                var im = document.createElement('img');
                im.src = msg.attachment.url;
                im.loading = 'lazy';
                im.onclick = function () { window.open(msg.attachment.url, '_blank'); };
                att.appendChild(im);
            } else if (msg.attachment.type === 'video') {
                var vi = document.createElement('video');
                vi.src = msg.attachment.url;
                vi.controls = true;
                att.appendChild(vi);
            } else if (msg.attachment.type === 'audio') {
                var au = document.createElement('audio');
                au.src = msg.attachment.url;
                au.controls = true;
                att.appendChild(au);
            }
            e.appendChild(att);
        }

        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            var rc = document.createElement('div');
            rc.className = 'pc-msg-reactions';
            var u = getCurrentUser();
            Object.keys(msg.reactions).forEach(function (emoji) {
                var uids = msg.reactions[emoji] || [];
                if (!Array.isArray(uids)) uids = Object.values(uids);
                var b = document.createElement('span');
                b.className = 'pc-reaction';
                if (u && uids.indexOf(u.uid) !== -1) b.classList.add('mine');
                b.textContent = emoji + ' ' + uids.length;
                b.onclick = (function (k, em) { return function () { pmToggleReaction(k, em); }; })(msg._key, emoji);
                rc.appendChild(b);
            });
            e.appendChild(rc);
        }

        var tm = document.createElement('div');
        tm.className = 'pc-msg-time';
        tm.textContent = formatTime(msg.time);
        e.appendChild(tm);

        var mb = document.createElement('button');
        mb.className = 'pc-msg-menu-btn';
        mb.textContent = '⋮';
        mb.onclick = function (ev) {
            ev.stopPropagation();
            ev.preventDefault();
            pmShowMenu(e, msg, isSent);
        };
        e.appendChild(mb);

        c.appendChild(e);
        c.scrollTop = c.scrollHeight;
    };

    /* ⭐ v8: deletedAt + blocked بالتوازي + batch mark-as-read */
    window.loadPrivateMessages = function () {
        if (!ChatState.currentPrivateChat) return;
        if (ChatState.privateMessagesListener) {
            try { ChatState.privateMessagesListener.off(); } catch (e) {}
            ChatState.privateMessagesListener = null;
        }
        var user = getCurrentUser();
        if (!user) return;
        var c = document.getElementById('pc-messages');
        if (c) c.innerHTML = '';

        var o = ChatState.currentPrivateChat.otherUid;

        // ⭐ v8: كل الفحوصات بالتوازي
        Promise.all([
            _isBlockedBetween(user.uid, o),
            db.ref('user_private_chats/' + user.uid + '/' + o + '/deletedAt').once('value')
                .then(function (s) { return s.val() || 0; })
                .catch(function () { return 0; })
        ]).then(function (results) {
            _updateInputState(results[0]);
            _startMessagesListener(results[1]);
        });

        function _startMessagesListener(deletedAtTs) {
            var ref = db.ref('user_private_messages/' + user.uid + '/' + o).limitToLast(50);
            ChatState.privateMessagesListener = ref;

            // ⭐ v8: قائمة الرسائل غير المقروءة — ستُعلَّم دفعة واحدة
            var _unreadKeys = [];

            ref.on('child_added', function (s) {
                var msg = s.val();
                if (!msg) return;
                msg._key = s.key;

                if (deletedAtTs && typeof msg.time === 'number' && msg.time < deletedAtTs) return;

                if (ChatState.seenPrivateMessages.has(s.key)) return;
                ChatState.seenPrivateMessages.add(s.key);
                var isSent = msg.fromUid === user.uid;
                displayPrivateMsg(msg, isSent);

                // ⭐ v8: اجمع غير المقروءة فقط — لا تكتب لكل رسالة
                if (!isSent && !msg.read) {
                    _unreadKeys.push(s.key);
                }
            });

            // ⭐ v8: بعد 500ms، علّم الكل كـ read مرة واحدة
            setTimeout(function () {
                if (_unreadKeys.length === 0) return;
                var updates = {};
                _unreadKeys.forEach(function (k) { updates[k + '/read'] = true; });
                db.ref('user_private_messages/' + user.uid + '/' + o).update(updates).catch(function () {});
                db.ref('user_private_chats/' + user.uid + '/' + o + '/unread').set(0).catch(function () {});
            }, 500);

            ref.on('child_changed', function (s) {
                var msg = s.val();
                if (!msg) return;
                msg._key = s.key;

                if (deletedAtTs && typeof msg.time === 'number' && msg.time < deletedAtTs) {
                    var old = document.querySelector('[data-pm-msg="' + s.key + '"]');
                    if (old) old.remove();
                    return;
                }

                var old = document.querySelector('[data-pm-msg="' + s.key + '"]');
                if (old) old.remove();
                displayPrivateMsg(msg, msg.fromUid === user.uid);
            });

            ref.on('child_removed', function (s) {
                var el = document.querySelector('[data-pm-msg="' + s.key + '"]');
                if (el) el.remove();
            });
        }
    };

    function _updateInputState(blocked) {
        var inp = document.getElementById('pc-input');
        var btn = inp ? inp.parentNode.querySelector('button') : null;
        if (!inp) return;
        if (blocked) {
            inp.disabled = true;
            inp.placeholder = '⏳ بانتظار مراجعة الإدارة';
            inp.classList.add('pc-input-blocked');
            if (btn) btn.disabled = true;
        } else {
            inp.disabled = false;
            inp.placeholder = 'اكتب رسالتك...';
            inp.classList.remove('pc-input-blocked');
            if (btn) btn.disabled = false;
        }
    }

    /* ⭐ v8: override clearPrivateNotifsFrom — محدود */
    window.clearPrivateNotifsFrom = function (fromUid) {
        var user = getCurrentUser();
        if (!user || !user.uid || !fromUid || !db) return;
        db.ref('user_notifications/' + user.uid).limitToLast(30).once('value').then(function (s) {
            var data = s.val() || {};
            var promises = [];
            Object.keys(data).forEach(function (k) {
                var n = data[k] || {};
                if (n.type === 'private' && n.fromUid === fromUid) {
                    promises.push(db.ref('user_notifications/' + user.uid + '/' + k).remove().catch(function () {}));
                }
            });
            if (promises.length > 0) {
                Promise.all(promises).then(function () {});
            }
        }).catch(function () {});
    };

    window.pmStartReply = function (msgId, senderName, text) {
        PM.replyingTo = { id: msgId, name: senderName, text: text };
        var p = document.getElementById('pm-reply-preview');
        var n = document.getElementById('pm-reply-name');
        var t = document.getElementById('pm-reply-text');
        if (p) p.classList.add('show');
        if (n) n.textContent = '↩ ' + senderName;
        if (t) t.textContent = (text || '').substring(0, 60);
        pmCloseAllMenus();
        pmCloseToolbar();
        var inp = document.getElementById('pc-input');
        if (inp && !inp.disabled) inp.focus();
    };

    window.pmCancelReply = function () {
        PM.replyingTo = null;
        var p = document.getElementById('pm-reply-preview');
        if (p) p.classList.remove('show');
    };

    function positionPopover(popover) {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var popW = popover.offsetWidth || 160;
        var popH = popover.offsetHeight || 180;

        var left = (vw - popW) / 2;
        if (left < 8) left = 8;

        var top = (vh - popH) / 2;
        if (top < 8) top = 8;

        popover.style.position = 'fixed';
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
        popover.style.right = 'auto';
        popover.style.bottom = 'auto';
    }

    window.pmShowMenu = function (msgEl, msg, isSent) {
        pmCloseAllMenus();
        var menu = document.createElement('div');
        menu.className = 'pc-msg-menu';

        var react = document.createElement('div');
        react.className = 'pc-msg-menu-item';
        react.textContent = '😊 تفاعل';
        react.onclick = function (e) {
            e.stopPropagation();
            menu.remove();
            pmShowEmojiBar(msgEl, msg._key);
        };
        menu.appendChild(react);

        var reply = document.createElement('div');
        reply.className = 'pc-msg-menu-item';
        reply.textContent = '💬 رد';
        reply.onclick = function (e) {
            e.stopPropagation();
            var sender = isSent ? (getCurrentUser().name || 'أنا') : ChatState.currentPrivateChat.otherName;
            pmStartReply(msg._key, sender, msg.text || '📎 مرفق');
        };
        menu.appendChild(reply);

        var report = document.createElement('div');
        report.className = 'pc-msg-menu-item';
        report.textContent = '🚨 إبلاغ';
        report.onclick = function (e) {
            e.stopPropagation();
            menu.remove();
            pmOpenReportDialog(msg);
        };
        menu.appendChild(report);

        if (!isSent) {
            var guardian = document.createElement('div');
            guardian.className = 'pc-msg-menu-item';
            guardian.textContent = '🚔 استدعاء السجان';
            guardian.style.color = '#ff9944';
            guardian.onclick = function (e) {
                e.stopPropagation();
                menu.remove();
                pmOpenGuardianCallDialog(msg);
            };
            menu.appendChild(guardian);
        }

        if (isSent && !msg.deleted && !msg.attachment) {
            var ed = document.createElement('div');
            ed.className = 'pc-msg-menu-item';
            ed.textContent = '✏️ تعديل';
            ed.onclick = function (e) {
                e.stopPropagation();
                menu.remove();
                pmEditMessage(msg._key, msg.text);
            };
            menu.appendChild(ed);
        }

        if (isSent && !msg.deleted) {
            var dl = document.createElement('div');
            dl.className = 'pc-msg-menu-item danger';
            dl.textContent = '🗑️ حذف';
            dl.onclick = function (e) {
                e.stopPropagation();
                menu.remove();
                pmDeleteMessage(msg._key);
            };
            menu.appendChild(dl);
        }

        menu.style.visibility = 'hidden';
        document.body.appendChild(menu);

        positionPopover(menu);
        menu.style.visibility = '';

        PM.openMenu = menu;

        setTimeout(function () {
            var h = function (ev) {
                if (PM.openMenu && !PM.openMenu.contains(ev.target)) {
                    if (PM.openMenu.parentNode) PM.openMenu.parentNode.removeChild(PM.openMenu);
                    PM.openMenu = null;
                    document.removeEventListener('click', h);
                }
            };
            document.addEventListener('click', h);
        }, 50);
    };

    window.pmShowEmojiBar = function (msgEl, msgKey) {
        pmCloseAllMenus();
        var bar = document.createElement('div');
        bar.className = 'pc-emoji-bar';
        ['👍', '❤️', '😂', '😮', '😢', '🔥'].forEach(function (em) {
            var s = document.createElement('span');
            s.textContent = em;
            s.onclick = function () { pmToggleReaction(msgKey, em); bar.remove(); };
            bar.appendChild(s);
        });
        bar.style.visibility = 'hidden';
        document.body.appendChild(bar);
        positionPopover(bar);
        bar.style.visibility = '';
        PM.openMenu = bar;
    };

    window.pmToggleReaction = async function (msgKey, emoji) {
        var user = getCurrentUser();
        if (!user || !msgKey || !ChatState.currentPrivateChat) return;
        var o = ChatState.currentPrivateChat.otherUid;
        try {
            var ref = db.ref('user_private_messages/' + user.uid + '/' + o + '/' + msgKey + '/reactions/' + emoji);
            var s = await ref.once('value');
            var uids = s.val() || [];
            if (!Array.isArray(uids)) uids = Object.values(uids);
            var i = uids.indexOf(user.uid);
            var newList = (i >= 0) ? uids.filter(function (x) { return x !== user.uid; }) : uids.concat([user.uid]);
            var val = newList.length > 0 ? newList : null;
            await Promise.all([
                db.ref('user_private_messages/' + user.uid + '/' + o + '/' + msgKey + '/reactions/' + emoji).set(val),
                db.ref('user_private_messages/' + o + '/' + user.uid + '/' + msgKey + '/reactions/' + emoji).set(val)
            ]);
        } catch (e) {}
        pmCloseAllMenus();
    };

    window.pmEditMessage = async function (msgKey, oldText) {
        var nt = prompt('✏️ تعديل:', oldText || '');
        if (nt === null) return;
        nt = nt.trim();
        if (!nt || nt === oldText) return;
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var o = ChatState.currentPrivateChat.otherUid;
        try {
            await Promise.all([
                db.ref('user_private_messages/' + user.uid + '/' + o + '/' + msgKey).update({ text: nt, edited: true }),
                db.ref('user_private_messages/' + o + '/' + user.uid + '/' + msgKey).update({ text: nt, edited: true })
            ]);
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم');
        } catch (e) { if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل'); }
    };

    window.pmDeleteMessage = async function (msgKey) {
        if (!confirm('🗑️ حذف هذه الرسالة؟')) return;
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var o = ChatState.currentPrivateChat.otherUid;
        try {
            await Promise.all([
                db.ref('user_private_messages/' + user.uid + '/' + o + '/' + msgKey).update({ deleted: true, text: '' }),
                db.ref('user_private_messages/' + o + '/' + user.uid + '/' + msgKey).update({ deleted: true, text: '' })
            ]);
        } catch (e) {}
    };

    window.pmDeleteAllMessages = async function () {
        if (!confirm('🗑️ حذف كل رسائل هذه المحادثة؟')) return;
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var o = ChatState.currentPrivateChat.otherUid;
        try {
            await Promise.all([
                db.ref('user_private_messages/' + user.uid + '/' + o).remove(),
                db.ref('user_private_messages/' + o + '/' + user.uid).remove(),
                db.ref('user_private_chats/' + user.uid + '/' + o).remove(),
                db.ref('user_private_chats/' + o + '/' + user.uid).remove()
            ]);
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم');
            var c = document.getElementById('pc-messages');
            if (c) c.innerHTML = '';
            setTimeout(function () {
                var m = document.getElementById('private-chat-modal');
                if (m) m.classList.remove('open');
                ChatState.currentPrivateChat = null;
            }, 800);
        } catch (e) {}
        pmCloseToolbar();
    };

    window.pmToggleToolbar = function () {
        var t = document.getElementById('pm-toolbar');
        if (t) t.classList.toggle('open');
    };
    window.pmCloseToolbar = function () {
        var t = document.getElementById('pm-toolbar');
        if (t) t.classList.remove('open');
    };
    window.pmPickImage = function () { var i = document.getElementById('pm-file-image'); if (i) i.click(); };
    window.pmPickVideo = function () { var i = document.getElementById('pm-file-video'); if (i) i.click(); };
    window.pmPickAudio = function () { var i = document.getElementById('pm-file-audio'); if (i) i.click(); };

    function _notifyPrivateRecipient(recipientUid, senderUser, previewText) {
        if (!recipientUid || !senderUser || !senderUser.uid) return;
        db.ref('user_notifications/' + recipientUid).push({
            fromUid: senderUser.uid,
            fromName: senderUser.name || 'مستخدم',
            fromAvatar: senderUser.avatar || '',
            type: 'private',
            preview: previewText || '',
            time: Date.now(),
            read: false
        }).catch(function (e) { console.warn('notif push failed:', e); });
    }

    window.pmHandleFile = async function (file, type) {
        if (!file) return;
        var maxMb = type === 'video' ? 20 : 5;
        if (file.size / (1024 * 1024) > maxMb) {
            if (typeof showToast === 'function') showToast('fa-exclamation-triangle', '⚠️ الحد ' + maxMb + 'MB');
            return;
        }
        if (typeof showToast === 'function') showToast('fa-spinner', '⏳ جاري الرفع...');
        try {
            var fd = new FormData();
            fd.append('key', IMGBB_KEY);
            fd.append('image', file);
            var r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
            var d = await r.json();
            if (d.success && d.data && d.data.url) {
                if (typeof showToast === 'function') showToast('fa-check', '✅ تم');
                pmSendWithAttachment(type, d.data.url, file.name);
            }
        } catch (e) {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل');
        }
    };

    async function pmSendWithAttachment(type, url, name) {
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var o = ChatState.currentPrivateChat.otherUid;

        var blocked = await _isBlockedBetween(user.uid, o);
        if (blocked) { if (typeof showToast === 'function') showToast('fa-lock', '⏳ بانتظار مراجعة الإدارة'); return; }

        var ts = firebase.database.ServerValue.TIMESTAMP;
        var md = {
            fromUid: user.uid, toUid: o, text: '', time: ts, read: false, deleted: false,
            attachment: { type: type, url: url, name: name }
        };
        if (PM.replyingTo) {
            md.replyTo = { id: PM.replyingTo.id, senderName: PM.replyingTo.name, text: (PM.replyingTo.text || '').substring(0, 100) };
        }
        var msgKey = db.ref('user_private_messages/' + user.uid + '/' + o).push().key;
        var previewText = type === 'image' ? '🖼️ صورة' : type === 'video' ? '🎥 فيديو' : '🎵 صوت';
        try {
            await Promise.all([
                db.ref('user_private_messages/' + user.uid + '/' + o + '/' + msgKey).set(Object.assign({}, md, { read: true })),
                db.ref('user_private_messages/' + o + '/' + user.uid + '/' + msgKey).set(md),
                db.ref('user_private_chats/' + user.uid + '/' + o).update({ otherUid: o, otherName: ChatState.currentPrivateChat.otherName, otherAvatar: ChatState.currentPrivateChat.otherAvatar, lastMessage: previewText, lastTime: Date.now() }),
                db.ref('user_private_chats/' + o + '/' + user.uid).update({ otherUid: user.uid, otherName: user.name, otherAvatar: user.avatar || '', lastMessage: previewText, lastTime: Date.now() })
            ]);
            db.ref('user_private_chats/' + o + '/' + user.uid + '/unread').transaction(function (c) { return (c || 0) + 1; });
            ChatState.seenPrivateMessages.add(msgKey);
            _notifyPrivateRecipient(o, user, previewText);
            pmCancelReply();
            pmCloseToolbar();
        } catch (e) {}
    }

    window.sendPrivateMsg = async function () {
        var i = document.getElementById('pc-input');
        if (!i) return;
        if (i.disabled) {
            if (typeof showToast === 'function') showToast('fa-lock', '⏳ بانتظار مراجعة الإدارة');
            return;
        }
        var text = i.value.trim();
        if (!text || !ChatState.currentPrivateChat) return;
        var user = getCurrentUser();
        if (!user || !user.uid) return;
        var now = Date.now();
        if (now - PM.lastSendAt < 2000) return;
        PM.lastSendAt = now;
        var o = ChatState.currentPrivateChat.otherUid;

        var blocked = await _isBlockedBetween(user.uid, o);
        if (blocked) {
            if (typeof showToast === 'function') showToast('fa-lock', '⏳ بانتظار مراجعة الإدارة');
            _updateInputState(true);
            return;
        }

        var ts = firebase.database.ServerValue.TIMESTAMP;
        var md = { fromUid: user.uid, toUid: o, text: text, time: ts, read: false, deleted: false };
        if (PM.replyingTo) {
            md.replyTo = { id: PM.replyingTo.id, senderName: PM.replyingTo.name, text: (PM.replyingTo.text || '').substring(0, 100) };
        }
        var msgKey = db.ref('user_private_messages/' + user.uid + '/' + o).push().key;
        var previewText = truncate(text, 50);
        try {
            await Promise.all([
                db.ref('user_private_messages/' + user.uid + '/' + o + '/' + msgKey).set(Object.assign({}, md, { read: true })),
                db.ref('user_private_messages/' + o + '/' + user.uid + '/' + msgKey).set(md),
                db.ref('user_private_chats/' + user.uid + '/' + o).update({ otherUid: o, otherName: ChatState.currentPrivateChat.otherName, otherAvatar: ChatState.currentPrivateChat.otherAvatar, lastMessage: previewText, lastTime: Date.now() }),
                db.ref('user_private_chats/' + o + '/' + user.uid).update({ otherUid: user.uid, otherName: user.name, otherAvatar: user.avatar || '', lastMessage: previewText, lastTime: Date.now() })
            ]);
            db.ref('user_private_chats/' + o + '/' + user.uid + '/unread').transaction(function (c) { return (c || 0) + 1; });
            ChatState.seenPrivateMessages.add(msgKey);
            _notifyPrivateRecipient(o, user, previewText);
            i.value = '';
            i.focus();
            pmCancelReply();
        } catch (e) {}
    };

    window.loadPrivateChatsList = function () {
        var list = document.getElementById('pm-list');
        if (!list) return;
        list.innerHTML = '';
        var c = Object.values(ChatState.privateChatsCache || {});
        if (c.length === 0) {
            var e = document.createElement('div');
            e.style.cssText = 'text-align:center;color:var(--text-dim);font-size:12px;padding:20px;';
            e.textContent = 'لا محادثات';
            list.appendChild(e);
            return;
        }
        c.sort(function(a, b) { return (b.lastTime || 0) - (a.lastTime || 0); });
        c.forEach(function(ch) {
            var i = document.createElement('div');
            i.className = 'sidebar-item';
            i.style.cssText += 'position:relative;padding-left:44px;';
            var img = document.createElement('img');
            img.src = ch.otherAvatar || getDefaultAvatar(ch.otherName);
            img.style.cssText = 'width:36px;height:36px;border-radius:50%;border:2px solid var(--gold);object-fit:cover;';
            var inf = document.createElement('div');
            inf.style.cssText = 'flex:1;min-width:0;';
            var n = document.createElement('div');
            n.style.cssText = 'color:#fff;font-weight:900;font-size:13px;';
            n.textContent = ch.otherName || 'مستخدم';
            var l = document.createElement('div');
            l.style.cssText = 'color:var(--text-dim);font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            l.textContent = ch.lastMessage || 'لا رسائل';
            inf.appendChild(n);
            inf.appendChild(l);
            i.appendChild(img);
            i.appendChild(inf);
            if (ch.unread > 0) {
                var b = document.createElement('span');
                b.style.cssText = 'background:#ff4444;color:#fff;border-radius:50%;min-width:18px;height:18px;font-size:10px;display:flex;justify-content:center;align-items:center;padding:0 4px;font-weight:900;';
                b.textContent = ch.unread > 9 ? '9+' : ch.unread;
                i.appendChild(b);
            }

            var delBtn = document.createElement('button');
            delBtn.className = 'pm-chat-del-btn';
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'حذف المحادثة';
            delBtn.style.cssText = 'position:absolute;left:8px;top:50%;transform:translateY(-50%);';
            delBtn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                pmDeleteChatWithConfirm(ch.otherUid, ch.otherName);
            };
            i.appendChild(delBtn);

            i.onclick = function(e) {
                if (e.target.closest('.pm-chat-del-btn')) return;
                closeAllPanels();
                openPrivateChatWith(ch.otherUid, ch.otherName, ch.otherAvatar);
            };
            list.appendChild(i);
        });
    };

    async function pmDeleteChatWithConfirm(otherUid, otherName) {
        if (!confirm('حذف المحادثة مع ' + (otherName || 'المستخدم') + '؟\n(ستُحذف عندك فقط)')) return;
        var user = getCurrentUser();
        if (!user || !user.uid) return;
        try {
            await db.ref('user_private_chats/' + user.uid + '/' + otherUid).update({
                deletedAt: Date.now(),
                lastMessage: 'لا رسائل'
            });
            if (ChatState.currentPrivateChat && ChatState.currentPrivateChat.otherUid === otherUid) {
                var c = document.getElementById('pc-messages');
                if (c) c.innerHTML = '';
                ChatState.seenPrivateMessages.clear();
                loadPrivateMessages();
            }
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم الحذف عندك');
        } catch(e) {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل: ' + e.message);
        }
    }
    window.pmDeleteChatWithConfirm = pmDeleteChatWithConfirm;

    function pmCloseAllMenus() {
        if (PM.openMenu && PM.openMenu.parentNode) PM.openMenu.parentNode.removeChild(PM.openMenu);
        PM.openMenu = null;
        document.querySelectorAll('.pc-msg-menu, .pc-emoji-bar').forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }
    window.pmCloseAllMenus = pmCloseAllMenus;

    function _playWarningSound() {
        try {
            var ctx = (typeof getAudioCtx === 'function') ? getAudioCtx() : null;
            if (!ctx) {
                if (!window._pmAudioCtx) {
                    try { window._pmAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
                }
                ctx = window._pmAudioCtx;
            }
            if (!ctx) return;
            var now = ctx.currentTime;
            var notes = [440, 554.37, 659.25];
            notes.forEach(function(freq, i) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'triangle';
                var start = now + i * 0.15;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.35, start + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.45);
            });
        } catch(e) {}
    }

    function _ensurePMDialog() {
        var d = document.getElementById('pm-dialog');
        if (d) return d;
        d = document.createElement('div');
        d.id = 'pm-dialog';
        d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(4px);display:none;justify-content:center;align-items:center;z-index:999999;padding:20px;direction:rtl;font-family:Cairo,sans-serif;';
        d.innerHTML = '<div id="pm-dialog-box" style="background:#110724;border:2px solid #ffd700;border-radius:16px;padding:20px;width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;"></div>';
        document.body.appendChild(d);
        d.addEventListener('click', function(e) { if (e.target === d) _closePMDialog(); });
        return d;
    }

    function _openPMDialog(htmlContent) {
        var d = _ensurePMDialog();
        document.getElementById('pm-dialog-box').innerHTML = htmlContent;
        d.style.display = 'flex';
    }
    function _closePMDialog() {
        var d = document.getElementById('pm-dialog');
        if (d) d.style.display = 'none';
    }
    window._closePMDialog = _closePMDialog;

    window.pmOpenReportDialog = function(msg) {
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var other = ChatState.currentPrivateChat;
        var sender = (msg.fromUid === user.uid) ? (user.name || 'أنا') : (other.otherName || 'المستخدم');

        var h = '';
        h += '<h3 style="color:#ffd700;font-size:16px;font-weight:900;text-align:center;margin:0;">🚨 تأكيد الإبلاغ</h3>';
        h += '<div style="color:#ccc;font-size:12px;text-align:center;line-height:1.5;">سيتم إبلاغ الإدارة عن هذه الرسالة من:</div>';
        h += '<div style="color:#fff;font-weight:900;text-align:center;font-size:14px;">' + _esc(sender) + '</div>';
        if (msg.text) {
            h += '<div style="color:#ffcccc;font-size:12px;background:rgba(0,0,0,0.4);padding:8px;border-radius:8px;max-height:100px;overflow-y:auto;word-break:break-word;">' + _esc(msg.text) + '</div>';
        }
        h += '<div style="color:#ffd700;font-size:12px;font-weight:900;margin-top:4px;">اختر السبب:</div>';
        h += '<div id="pm-report-reasons" style="display:flex;flex-direction:column;gap:6px;">';
        REPORT_REASONS.forEach(function(r) {
            h += '<button type="button" class="pm-report-reason-btn" data-r="' + r.id + '" style="padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,215,0,0.3);border-radius:10px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;text-align:right;">' + r.icon + ' ' + r.name + '</button>';
        });
        h += '</div>';
        h += '<button onclick="_closePMDialog()" style="padding:10px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,215,0,0.2);border-radius:10px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer;">إلغاء</button>';

        _openPMDialog(h);

        document.querySelectorAll('.pm-report-reason-btn').forEach(function(btn) {
            btn.onclick = async function() {
                var reason = this.getAttribute('data-r');
                _closePMDialog();
                await pmSendReport(msg, reason);
            };
        });
    };

    function _esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function(c) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
        });
    }

    async function pmSendReport(msg, reason) {
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var other = ChatState.currentPrivateChat;
        var targetUid = (msg.fromUid === user.uid) ? other.otherUid : msg.fromUid;
        var targetName = (targetUid === other.otherUid) ? other.otherName : (user.name || 'أنا');

        if (!targetUid) { if (typeof showToast === 'function') showToast('fa-times', '⚠️ لا هدف'); return; }

        try {
            var hourAgo = Date.now() - 3600000;
            var existing = await db.ref('reports').orderByChild('time').startAt(hourAgo).once('value');
            var data = existing.val() || {};
            var duplicate = Object.values(data).some(function(r) {
                return r.reporterUid === user.uid && r.targetUid === targetUid;
            });
            if (duplicate) {
                if (typeof showToast === 'function') showToast('fa-clock', '⏳ أبلغت عن هذا المستخدم مؤخراً');
                return;
            }
        } catch(e) {}

        var payload = {
            reporterUid: user.uid,
            reporterName: user.name || 'زائر',
            reporterAvatar: user.avatar || '',
            targetUid: targetUid,
            targetName: targetName || '',
            targetAvatar: other.otherAvatar || '',
            reason: reason,
            messageText: (msg.text || '').substring(0, 300),
            messageKey: msg._key || null,
            roomId: 'private',
            isPrivate: true,
            time: Date.now(),
            status: 'pending'
        };

        try {
            await db.ref('reports').push(payload);
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم الإبلاغ');
        } catch(e) {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل: ' + e.message);
        }
    }

    window.pmOpenGuardianCallDialog = function(msg) {
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var other = ChatState.currentPrivateChat;
        var sender = (msg.fromUid === user.uid) ? (user.name || 'أنا') : (other.otherName || 'المستخدم');

        var h = '';
        h += '<h3 style="color:#ff9944;font-size:16px;font-weight:900;text-align:center;margin:0;">🚔 استدعاء السجان</h3>';
        h += '<div style="color:#ccc;font-size:12px;text-align:center;line-height:1.6;">سيتم:</div>';
        h += '<ul style="color:#fff;font-size:12px;line-height:1.8;padding-right:20px;margin:0;">';
        h += '<li>إرسال الرسالة للإدارة</li>';
        h += '<li>حظر مؤقت بينك وبين ' + _esc(sender) + '</li>';
        h += '<li>إذا كانت تحتوي كلمات طرد → طرد فوري</li>';
        h += '</ul>';
        if (msg.text) {
            h += '<div style="color:#ffcccc;font-size:12px;background:rgba(0,0,0,0.4);padding:8px;border-radius:8px;max-height:100px;overflow-y:auto;word-break:break-word;">' + _esc(msg.text) + '</div>';
        }
        h += '<div style="display:flex;gap:8px;">';
        h += '<button id="pm-guardian-confirm" style="flex:1;padding:12px;background:#ff9944;color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer;">✅ نعم، استدعِ</button>';
        h += '<button onclick="_closePMDialog()" style="flex:1;padding:12px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,215,0,0.2);border-radius:10px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer;">❌ إلغاء</button>';
        h += '</div>';

        _openPMDialog(h);
        document.getElementById('pm-guardian-confirm').onclick = async function() {
            _closePMDialog();
            await pmExecuteGuardianCall(msg);
        };
    };

    async function pmExecuteGuardianCall(msg) {
        var user = getCurrentUser();
        if (!user || !ChatState.currentPrivateChat) return;
        var other = ChatState.currentPrivateChat;
        var targetUid = msg.fromUid;
        var targetName = (targetUid === other.otherUid) ? other.otherName : '';

        if (!targetUid || targetUid === user.uid) {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ لا يمكن');
            return;
        }

        var text = msg.text || '';
        var now = Date.now();

        var hasKickWord = false;
        var kickWord = '';
        if (typeof BotsState !== 'undefined' && BotsState.kickWords) {
            var norm = (typeof normalizeArabic === 'function') ? normalizeArabic(text) : text.toLowerCase();
            for (var i = 0; i < BotsState.kickWords.length; i++) {
                var w = BotsState.kickWords[i];
                var nw = (typeof normalizeArabic === 'function') ? normalizeArabic(w) : w.toLowerCase();
                if (nw && norm.indexOf(nw) !== -1) { hasKickWord = true; kickWord = w; break; }
            }
        }

        if (hasKickWord) {
            try {
                var snap = await db.ref('users/' + targetUid).once('value');
                var targetData = snap.val() || {};
                var kc = targetData.kickCount || 0;
                await db.ref('users/' + targetUid).update({
                    isBanned: true,
                    bannedUntil: now + 365 * 24 * 60 * 60 * 1000,
                    kickCount: kc + 1,
                    lastKickAt: now,
                    kickReason: 'guardian_call:' + kickWord,
                    permanentBan: true
                });
                if (typeof showToast === 'function') showToast('fa-ban', '🚔 تم طرد ' + (targetName || 'المستخدم') + ' نهائياً');
                _notifyAdminsGuardianCall(user, targetUid, targetName, text, 'kick_word');
                return;
            } catch(e) {
                console.warn('guardian kick failed:', e);
            }
        }

        try {
            await Promise.all([
                db.ref('user_private_blocks/' + user.uid + '/' + targetUid).set({
                    at: now, reason: 'guardian_call', by: user.uid
                }),
                db.ref('user_private_blocks/' + targetUid + '/' + user.uid).set({
                    at: now, reason: 'guardian_call', by: user.uid
                })
            ]);
        } catch(e) { console.warn('block set failed:', e); }

        _updateInputState(true);

        await _notifyAdminsGuardianCall(user, targetUid, targetName, text, 'normal');

        _showGuardianCallModal(user, targetName, text);
        _playWarningSound();

        try {
            await db.ref('guardian_calls').push({
                callerUid: user.uid,
                callerName: user.name || 'زائر',
                targetUid: targetUid,
                targetName: targetName || '',
                messageText: text.substring(0, 300),
                messageKey: msg._key || null,
                status: 'pending',
                time: now
            });
        } catch(e) {}
    }

    async function _notifyAdminsGuardianCall(caller, targetUid, targetName, text, type) {
        try {
            var s = await db.ref('users').limitToLast(500).once('value');
            var all = s.val() || {};
            var admins = [];
            Object.keys(all).forEach(function(uid) {
                var u = all[uid] || {};
                var lvl = u.rankLevel || (typeof getRankLevel === 'function' ? getRankLevel(u.rank) : 0);
                if (lvl >= 90 || u.rank === 'King' || u.rank === 'Queen') {
                    admins.push(uid);
                }
            });

            var callerName = caller.name || 'زائر';
            var previewText = '🚔 استدعاء ضد ' + (targetName || 'مجهول');

            for (var i = 0; i < admins.length; i++) {
                var aid = admins[i];
                if (aid === caller.uid) continue;

                var msgKey = db.ref('user_private_messages/' + aid + '/bot_guardian').push().key;
                var guardianMessage = 
                    '🚨 استدعاء سجان\n\n' +
                    '👤 المُبلِّغ: ' + callerName + '\n' +
                    '👤 ضد: ' + (targetName || 'مجهول') + '\n' +
                    '📝 السبب: ' + (type === 'kick_word' ? 'كلمة محظورة (تم الطرد)' : 'طلب فحص') + '\n' +
                    '💬 نص الرسالة:\n"' + (text || '—') + '"\n\n' +
                    '🕐 ' + new Date().toLocaleString('ar-EG') + '\n' +
                    '🔒 ' + (targetName || 'المستخدم') + ' محظور مؤقتاً من ' + callerName;

                var md = {
                    fromUid: 'bot_guardian',
                    toUid: aid,
                    text: guardianMessage,
                    time: firebase.database.ServerValue.TIMESTAMP,
                    read: false,
                    deleted: false,
                    isGuardianCall: true,
                    callerUid: caller.uid,
                    callerName: callerName,
                    targetUid: targetUid,
                    targetName: targetName,
                    guardianCallType: type
                };

                await Promise.all([
                    db.ref('user_private_messages/' + aid + '/bot_guardian/' + msgKey).set(md),
                    db.ref('user_private_chats/' + aid + '/bot_guardian').update({
                        otherUid: 'bot_guardian',
                        otherName: '🚔 السجان',
                        otherAvatar: 'https://ui-avatars.com/api/?name=%D8%A7%D9%84%D8%B3%D8%AC%D8%A7%D9%86&background=111&color=ff4444&bold=true&size=64',
                        lastMessage: previewText,
                        lastTime: Date.now()
                    })
                ]);

                db.ref('user_notifications/' + aid).push({
                    fromUid: 'bot_guardian',
                    fromName: '🚔 السجان',
                    fromAvatar: '',
                    type: 'private',
                    preview: previewText,
                    time: Date.now(),
                    read: false
                }).catch(function(){});
            }
        } catch(e) { console.warn('notifyAdmins error:', e); }
    }

    function _showGuardianCallModal(caller, targetName, text) {
        var me = getCurrentUser();
        if (!me) return;
        if (me.uid === caller.uid) return;

        if (document.getElementById('pm-guardian-modal')) return;

        var m = document.createElement('div');
        m.id = 'pm-guardian-modal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(6px);display:flex;justify-content:center;align-items:center;z-index:999998;padding:20px;direction:rtl;font-family:Cairo,sans-serif;';
        m.innerHTML =
            '<div style="background:linear-gradient(135deg,#2a0a0a,#1a0505);border:2px solid #ff4444;border-radius:20px;padding:24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.9),0 0 40px rgba(255,68,68,0.4);animation:pmCallIn 0.4s ease-out;">' +
                '<div style="font-size:56px;line-height:1;margin-bottom:12px;filter:drop-shadow(0 0 15px rgba(255,68,68,0.7));">🚔</div>' +
                '<div style="color:#ff6666;font-size:14px;font-weight:900;letter-spacing:1px;margin-bottom:10px;">تم استدعاء السجان</div>' +
                '<div style="color:#fff;font-size:14px;line-height:1.6;margin-bottom:14px;">' +
                    'استُدعي السجان عليك من:<br>' +
                    '<b style="color:#ffd700;">' + _esc(caller.name || 'زائر') + '</b>' +
                '</div>' +
                (text ? '<div style="color:#ffcccc;font-size:11px;background:rgba(0,0,0,0.5);padding:8px;border-radius:8px;margin-bottom:14px;max-height:80px;overflow-y:auto;word-break:break-word;">"' + _esc(text) + '"</div>' : '') +
                '<div style="color:#ffaaaa;font-size:11px;line-height:1.5;margin-bottom:16px;">⚠️ عليك انتظار مراجعة الإدارة قبل مراسلته</div>' +
                '<button id="pm-guardian-modal-ok" type="button" style="padding:11px 32px;background:#ff4444;color:#fff;border:none;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px rgba(255,68,68,0.5);">حسناً</button>' +
            '</div>';

        if (!document.getElementById('pm-guardian-anim')) {
            var st = document.createElement('style');
            st.id = 'pm-guardian-anim';
            st.textContent = '@keyframes pmCallIn{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.05);opacity:1}100%{transform:scale(1);opacity:1}}';
            document.head.appendChild(st);
        }

        document.body.appendChild(m);
        var close = function() { if (m.parentNode) m.parentNode.removeChild(m); };
        document.getElementById('pm-guardian-modal-ok').onclick = close;
        setTimeout(close, 15000);
    }

    function installPMObserver() {
        var modal = document.getElementById('private-chat-modal');
        if (!modal) { setTimeout(installPMObserver, 1000); return; }
        enhanceModal();
        var obs = new MutationObserver(function () {
            if (modal.classList.contains('open')) {
                enhanceModal();
                setTimeout(function () { loadPrivateMessages(); }, 100);
            } else {
                pmCloseToolbar();
                pmCancelReply();
                pmCloseAllMenus();
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPMObserver);
    } else {
        installPMObserver();
    }

    console.log('✅ pm-enhanced.js v8 loaded — parallel checks + batch read');
})();
