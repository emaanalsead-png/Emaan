// ==============================================
// supabase-adapter.js v1 — Firebase-compatible db
// ==============================================

(function () {
    'use strict';
    if (window.__supabaseAdapterV1) return;
    window.__supabaseAdapterV1 = true;

    var client = window.supabaseClient;
    if (!client) {
        console.error('❌ supabase-adapter: client missing');
        return;
    }

    function _now() { return Date.now(); }

    function _cleanPath(p) {
        if (!p) return '';
        return String(p).replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).join('/');
    }

    /* ─── Snapshot ─── */
    function Snapshot(path, rows, opts) {
        this._path = path;
        this._rows = rows || [];
        this._opts = opts || {};
    }

    Snapshot.prototype.val = function () {
        var path = this._path;
        var rows = this._rows;
        if (!rows.length) return null;

        for (var i = 0; i < rows.length; i++) {
            if (rows[i].path === path) return rows[i].value;
        }

        for (var i = 0; i < rows.length; i++) {
            var ap = rows[i].path;
            if (path.indexOf(ap + '/') === 0) {
                var rel = path.substring(ap.length + 1);
                var parts = rel.split('/');
                var cur = rows[i].value;
                for (var j = 0; j < parts.length; j++) {
                    if (cur == null) return null;
                    cur = cur[parts[j]];
                }
                return cur === undefined ? null : cur;
            }
        }

        var result = {};
        var prefix = path + '/';
        var hasAny = false;
        rows.forEach(function (row) {
            if (row.path.indexOf(prefix) !== 0) return;
            var rel = row.path.substring(prefix.length);
            var parts = rel.split('/');
            var cur = result;
            for (var i = 0; i < parts.length - 1; i++) {
                if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
                    cur[parts[i]] = {};
                }
                cur = cur[parts[i]];
            }
            cur[parts[parts.length - 1]] = row.value;
            hasAny = true;
        });

        return hasAny ? result : null;
    };

    Snapshot.prototype.exists = function () { return this._rows.length > 0; };

    Snapshot.prototype.numChildren = function () {
        var count = 0;
        this.forEach(function () { count++; });
        return count;
    };

    Snapshot.prototype.forEach = function (cb) {
        var path = this._path;
        var rows = this._rows;
        var prefix = path ? path + '/' : '';
        var seen = {};
        var self = this;
        rows.forEach(function (r) {
            if (r.path === path) return;
            if (prefix && r.path.indexOf(prefix) !== 0) return;
            var rel = prefix ? r.path.substring(prefix.length) : r.path;
            var childKey = rel.split('/')[0];
            if (!childKey || seen[childKey]) return;
            seen[childKey] = true;
            var childPath = prefix ? prefix + childKey : childKey;
            var childRows = rows.filter(function (x) {
                return x.path === childPath || x.path.indexOf(childPath + '/') === 0;
            });
            var snap = new Snapshot(childPath, childRows, self._opts);
            if (cb(snap) === true) return;
        });
    };

    Object.defineProperty(Snapshot.prototype, 'key', {
        get: function () {
            var parts = this._path.split('/').filter(Boolean);
            return parts.length ? parts[parts.length - 1] : null;
        }
    });

    /* ─── Ref ─── */
    function Ref(path, opts) {
        this._path = _cleanPath(path);
        this._opts = opts || {};
        this._listeners = [];
    }

    Object.defineProperty(Ref.prototype, 'key', {
        get: function () {
            var parts = this._path.split('/').filter(Boolean);
            return parts.length ? parts[parts.length - 1] : null;
        }
    });

    Ref.prototype.child = function (sub) {
        var p = this._path ? this._path + '/' + _cleanPath(sub) : _cleanPath(sub);
        return new Ref(p, {});
    };

    Ref.prototype.limitToLast = function (n) {
        var o = Object.assign({}, this._opts);
        o.limit = parseInt(n) || 0;
        return new Ref(this._path, o);
    };
    Ref.prototype.limitToFirst = Ref.prototype.limitToLast;

    Ref.prototype.orderByChild = function (f) {
        var o = Object.assign({}, this._opts);
        o.orderBy = f;
        return new Ref(this._path, o);
    };

    Ref.prototype.startAt = function (v) {
        var o = Object.assign({}, this._opts);
        o.startAt = v;
        return new Ref(this._path, o);
    };

    Ref.prototype.toString = function () { return 'https://supabase/' + this._path; };

    Ref.prototype.once = function (eventType) {
        var self = this;
        return _fetch(self._path).then(function (rows) {
            return new Snapshot(self._path, rows, self._opts);
        });
    };

    async function _fetch(path) {
        var conditions = [];
        if (path) {
            conditions.push('path.eq.' + path);
            conditions.push('path.like.' + path + '/%');
            var parts = path.split('/');
            while (parts.length > 1) {
                parts.pop();
                conditions.push('path.eq.' + parts.join('/'));
            }
        }
        var query = client.from('kv_store').select('*');
        if (conditions.length) {
            query = query.or(conditions.join(','));
        } else {
            query = query.limit(2000);
        }
        var res = await query;
        if (res.error) {
            console.warn('kv fetch error:', res.error);
            return [];
        }
        return res.data || [];
    }

    Ref.prototype.on = function (eventType, callback, errorCb) {
        var self = this;

        if (eventType === 'child_added' || eventType === 'child_changed' || eventType === 'child_removed') {
            return self._onChild(eventType, callback, errorCb);
        }

        var listener = { eventType: eventType, callback: callback, channel: null, last: null };

        _fetch(self._path).then(function (rows) {
            var sig = JSON.stringify(rows);
            listener.last = sig;
            try { callback(new Snapshot(self._path, rows, self._opts)); } catch (e) {}
        });

        var ch = client.channel('kv-' + Math.random().toString(36).slice(2, 10));
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'kv_store' }, function (payload) {
            var changedPath = (payload.new && payload.new.path) || (payload.old && payload.old.path);
            if (!changedPath) return;
            if (self._path && changedPath !== self._path && changedPath.indexOf(self._path + '/') !== 0) return;

            _fetch(self._path).then(function (rows) {
                var sig = JSON.stringify(rows);
                if (sig === listener.last) return;
                listener.last = sig;
                try { callback(new Snapshot(self._path, rows, self._opts)); } catch (e) {}
            });
        }).subscribe();

        listener.channel = ch;
        this._listeners.push(listener);
        return callback;
    };

    Ref.prototype._onChild = function (eventType, callback, errorCb) {
        var self = this;
        var listener = { eventType: eventType, callback: callback, channel: null, known: {} };

        _fetch(self._path).then(function (rows) {
            var prefix = self._path ? self._path + '/' : '';
            rows.forEach(function (r) {
                if (r.path === self._path) return;
                var rel = prefix ? r.path.substring(prefix.length) : r.path;
                var childKey = rel.split('/')[0];
                if (!childKey) return;
                var childPath = prefix ? prefix + childKey : childKey;
                if (listener.known[childPath]) return;
                listener.known[childPath] = true;
                if (eventType === 'child_added') {
                    var childRows = rows.filter(function (x) {
                        return x.path === childPath || x.path.indexOf(childPath + '/') === 0;
                    });
                    try { callback(new Snapshot(childPath, childRows, {})); } catch (e) {}
                }
            });
        });

        var ch = client.channel('kvc-' + Math.random().toString(36).slice(2, 10));
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'kv_store' }, function (payload) {
            var cp = (payload.new && payload.new.path) || (payload.old && payload.old.path);
            if (!cp) return;
            var prefix = self._path ? self._path + '/' : '';
            if (self._path && cp.indexOf(prefix) !== 0) return;
            var rel = prefix ? cp.substring(prefix.length) : cp;
            var childKey = rel.split('/')[0];
            if (!childKey) return;
            var childPath = prefix ? prefix + childKey : childKey;

            if (payload.eventType === 'INSERT') {
                if (listener.known[childPath]) return;
                listener.known[childPath] = true;
                if (eventType === 'child_added') {
                    _fetch(self._path).then(function (rows) {
                        var cRows = rows.filter(function (x) {
                            return x.path === childPath || x.path.indexOf(childPath + '/') === 0;
                        });
                        try { callback(new Snapshot(childPath, cRows, {})); } catch (e) {}
                    });
                }
            } else if (payload.eventType === 'UPDATE') {
                if (eventType === 'child_changed') {
                    _fetch(self._path).then(function (rows) {
                        var cRows = rows.filter(function (x) {
                            return x.path === childPath || x.path.indexOf(childPath + '/') === 0;
                        });
                        try { callback(new Snapshot(childPath, cRows, {})); } catch (e) {}
                    });
                }
            } else if (payload.eventType === 'DELETE') {
                if (!listener.known[childPath]) return;
                delete listener.known[childPath];
                if (eventType === 'child_removed') {
                    try { callback(new Snapshot(childPath, [], {})); } catch (e) {}
                }
            }
        }).subscribe();

        listener.channel = ch;
        this._listeners.push(listener);
        return callback;
    };

    Ref.prototype.off = function (eventType, callback) {
        var toRemove = [];
        this._listeners.forEach(function (l) {
            if (eventType && l.eventType !== eventType) return;
            if (callback && l.callback !== callback) return;
            try { l.channel.unsubscribe(); } catch (e) {}
            toRemove.push(l);
        });
        this._listeners = this._listeners.filter(function (l) {
            return toRemove.indexOf(l) === -1;
        });
    };

    Ref.prototype.set = function (value) {
        var self = this;
        var now = _now();
        var v = _resolveServerValue(value);

        return client.from('kv_store')
            .delete()
            .or('path.eq.' + self._path + ',path.like.' + self._path + '/%')
            .then(function () {
                return client.from('kv_store').upsert({
                    path: self._path,
                    value: v,
                    updated_at: now,
                    created_at: now
                });
            }).then(function (res) {
                if (res.error) throw res.error;
                return res;
            });
    };

    Ref.prototype.update = function (updates) {
        var self = this;
        var now = _now();
        var promises = [];

        Object.keys(updates || {}).forEach(function (k) {
            var v = _resolveServerValue(updates[k]);
            var subPath = _cleanPath(k);
            if (subPath.indexOf('/') === -1) {
                subPath = self._path ? self._path + '/' + subPath : subPath;
            }
            promises.push(
                client.from('kv_store').upsert({
                    path: subPath,
                    value: v,
                    updated_at: now,
                    created_at: now
                })
            );
        });

        return Promise.all(promises).then(function (results) {
            results.forEach(function (r) { if (r.error) throw r.error; });
            return results;
        });
    };

    Ref.prototype.remove = function () {
        var self = this;
        return client.from('kv_store')
            .delete()
            .or('path.eq.' + self._path + ',path.like.' + self._path + '/%')
            .then(function (res) {
                if (res.error) throw res.error;
                return res;
            });
    };

    Ref.prototype.push = function (value) {
        var self = this;
        var key = _genKey();
        var newPath = self._path ? self._path + '/' + key : key;
        var childRef = new Ref(newPath, {});

        var ret = {
            key: key,
            set: function (v) { return childRef.set(v); },
            update: function (v) { return childRef.update(v); },
            remove: function () { return childRef.remove(); },
            once: function (e) { return childRef.once(e); },
            on: function (e, cb, ecb) { return childRef.on(e, cb, ecb); },
            off: function (e, cb) { return childRef.off(e, cb); },
            child: function (s) { return childRef.child(s); },
            then: function (a, b) {
                if (value === undefined) {
                    return Promise.resolve(ret).then(a, b);
                }
                return childRef.set(value).then(function () { return ret; }).then(a, b);
            },
            catch: function (a) { return ret.then(null, a); }
        };
        return ret;
    };

    Ref.prototype.transaction = function (fn) {
        var self = this;
        return self.once('value').then(function (snap) {
            var current = snap.val();
            var newVal = fn(current);
            if (newVal === undefined) {
                return { committed: false, snapshot: snap };
            }
            return self.set(newVal).then(function () {
                return {
                    committed: true,
                    snapshot: new Snapshot(self._path, [{ path: self._path, value: newVal }], {})
                };
            });
        }).catch(function (err) {
            console.warn('transaction error:', err);
            return { committed: false, snapshot: null };
        });
    };

    Ref.prototype.keepSynced = function () { return this; };
    Ref.prototype.onDisconnect = function () {
        return {
            set: function () { return Promise.resolve(); },
            remove: function () { return Promise.resolve(); },
            cancel: function () {}
        };
    };

    function _genKey() {
        var t = Date.now().toString(36).toUpperCase();
        var r = Math.random().toString(36).slice(2, 10).toUpperCase();
        return '-N' + t + r;
    }

    function _resolveServerValue(v) {
        if (v === 'SERVER_TIMESTAMP') return Date.now();
        if (typeof v === 'object' && v !== null) {
            if (v['.sv'] === 'timestamp') return Date.now();
            if (Array.isArray(v)) return v.map(_resolveServerValue);
            var out = {};
            Object.keys(v).forEach(function (k) {
                out[k] = _resolveServerValue(v[k]);
            });
            return out;
        }
        return v;
    }

    var dbAdapter = {
        ref: function (path) { return new Ref(path || ''); },
        ServerValue: { TIMESTAMP: 'SERVER_TIMESTAMP' }
    };

    try {
        db = dbAdapter;
        console.log('✅ supabase-adapter: db replaced');
    } catch (e) {
        console.warn('⚠️ could not replace db — using window.db');
        window.db = dbAdapter;
    }

    console.log('📦 supabase-adapter.js v1 loaded');
})();
