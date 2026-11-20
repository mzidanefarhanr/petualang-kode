/*
 * Host + integrasi editor Scratch untuk Scratch Kelas.
 *
 * scratch-gui / scratch-vm dipakai apa adanya lewat API embedding resmi
 * (`EditorState` + `createStandaloneRoot`). Integrasi kelas (bar atas, autosave,
 * save intent, tombol Kumpulkan, mode baca-saja) hidup di file ini, bukan di
 * dalam paket scratch-gui.
 */
(function () {
    'use strict';

    var CFG = window.__SCRATCH_KELAS__ || {};
    var APP = CFG.appUrl || '';
    var GUI = window.GUI;

    var AUTOSAVE_DEBOUNCE_MS = 30000;
    var FORCE_SAVE_MS = 5 * 60 * 1000;
    var SAVE_INTENT_LEAD_MS = 5000;

    var el = {};
    var state = null;
    var vm = null;
    var assignmentId = null;
    var info = null;
    var readOnly = false;
    var canEdit = false;
    var dirty = false;
    var saving = false;
    var lastSnapshotId = null;
    var serverOffsetMs = 0;
    var timers = {debounce: null, force: null, deadline: null, intent: null};

    function $(id) {
        return document.getElementById(id);
    }

    function readCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    function genId() {
        return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    }

    function api(path, options) {
        options = options || {};
        options.credentials = 'include';
        return fetch(APP + path, options);
    }

    function setStatus(text) {
        if (el.status) {
            el.status.textContent = text;
        }
    }

    function computeOffset(dateHeader) {
        var server = Date.parse(dateHeader || '');
        return Number.isNaN(server) ? 0 : server - Date.now();
    }

    function hashHex(buffer) {
        return crypto.subtle.digest('SHA-256', buffer).then(function (digest) {
            return Array.prototype.map
                .call(new Uint8Array(digest), function (byte) {
                    return byte.toString(16).padStart(2, '0');
                })
                .join('');
        });
    }

    function fatal(title, message, link) {
        el.bar.hidden = true;
        el.stage.innerHTML =
            '<div class="fatal"><h1></h1><p></p><p><a></a></p></div>';
        el.stage.querySelector('h1').textContent = title;
        el.stage.querySelector('p').textContent = message;
        var anchor = el.stage.querySelector('a');
        if (link) {
            anchor.href = link;
            anchor.textContent = 'Kembali';
        } else {
            anchor.remove();
        }
    }

    function showNotice(text) {
        var existing = el.stage.querySelector('.notis');
        if (existing) {
            existing.remove();
        }
        var node = document.createElement('div');
        node.className = 'notis';
        node.textContent = text;
        el.stage.appendChild(node);
    }

    function mountEditor() {
        var target = document.createElement('div');
        target.id = 'scratch-editor';
        el.stage.appendChild(target);

        GUI.setAppElement(target);
        state = new GUI.EditorState({});
        var root = GUI.createStandaloneRoot(state, target);
        root.render({canEditTitle: false, canSave: false});
        // Memuat proyek bawaan agar antarmuka berpindah ke keadaan "menampilkan".
        state.dispatch(GUI.setProjectId(GUI.defaultProjectId));
        vm = state.store.getState().scratchGui.vm;
    }

    function whenShowing(callback) {
        var loading = String(state.store.getState().scratchGui.projectState.loadingState);
        if (loading.indexOf('SHOWING') === 0) {
            callback();
            return;
        }
        setTimeout(function () {
            whenShowing(callback);
        }, 150);
    }

    function loadLastProject(callback) {
        api('/api/v1/editor/projects/' + assignmentId)
            .then(function (response) {
                if (response.status === 204) {
                    return null;
                }
                if (!response.ok) {
                    return null;
                }
                return response.arrayBuffer();
            })
            .then(function (buffer) {
                if (!buffer) {
                    callback();
                    return;
                }
                vm.loadProject(new Uint8Array(buffer)).then(callback, callback);
            })
            .catch(function () {
                callback();
            });
    }

    function setReadOnly(value) {
        readOnly = value;
        var target = document.getElementById('scratch-editor');
        if (target) {
            target.style.pointerEvents = value ? 'none' : '';
            target.style.opacity = value ? '0.85' : '';
            // `inert` mengunci interaksi lewat keyboard, bukan hanya pointer.
            if (value) {
                target.setAttribute('inert', '');
            } else {
                target.removeAttribute('inert');
            }
        }
        if (value) {
            stopAutosaveTimers();
        }
    }

    function stopAutosaveTimers() {
        clearInterval(timers.force);
        clearTimeout(timers.debounce);
        timers.force = null;
        timers.debounce = null;
    }

    function onProjectChanged() {
        if (readOnly || !canEdit || saving) {
            return;
        }
        dirty = true;
        setStatus('Menyimpan...');
        clearTimeout(timers.debounce);
        timers.debounce = setTimeout(function () {
            doSave('otomatis');
        }, AUTOSAVE_DEBOUNCE_MS);
    }

    function postSnapshot(bytes, jenis, extra) {
        var headers = {
            'Content-Type': 'application/octet-stream',
            'X-CSRF-Token': readCookie('csrf_token'),
            'Idempotency-Key': genId()
        };
        if (extra && extra.saveIntentToken) {
            headers['X-Save-Intent-Token'] = extra.saveIntentToken;
        }
        return api('/api/v1/editor/projects/' + assignmentId + '/snapshots?jenis=' + jenis, {
            method: 'POST',
            headers: headers,
            body: bytes
        }).then(function (response) {
            if (!response.ok) {
                return response.json().then(
                    function (body) {
                        throw {status: response.status, kode: body && body.error && body.error.kode};
                    },
                    function () {
                        throw {status: response.status};
                    }
                );
            }
            return response.json();
        });
    }

    function failureStatus(error) {
        if (!error || error.status === undefined || error.status === 0) {
            return 'Koneksi terputus. Perubahan terakhir mungkin belum tersimpan.';
        }
        return 'Belum tersimpan. Mencoba lagi.';
    }

    function doSave(jenis, extra) {
        if (readOnly || !canEdit || saving) {
            return Promise.resolve(null);
        }
        clearTimeout(timers.debounce);
        return vm
            .saveProjectSb3()
            .then(function (blob) {
                return blob.arrayBuffer();
            })
            .then(function (buffer) {
                saving = true;
                setStatus('Menyimpan...');
                return postSnapshot(new Uint8Array(buffer), jenis, extra);
            })
            .then(function (json) {
                saving = false;
                dirty = false;
                if (json && json.snapshot_id) {
                    lastSnapshotId = json.snapshot_id;
                }
                setStatus('Tersimpan');
                return json;
            })
            .catch(function (error) {
                saving = false;
                setStatus(failureStatus(error));
                throw error;
            });
    }

    function scheduleFinalization() {
        var deadlineServer = Date.parse(info.assignment.ditutup_pada);
        var deadlineLocal = deadlineServer - serverOffsetMs;
        var now = Date.now();

        timers.intent = setTimeout(finalSave, Math.max(0, deadlineLocal - SAVE_INTENT_LEAD_MS - now));
        timers.deadline = setTimeout(goReadOnly, Math.max(0, deadlineLocal - now));
    }

    function goReadOnly() {
        canEdit = false;
        setReadOnly(true);
        setStatus('Tugas sudah ditutup (hanya baca)');
    }

    function finalSave() {
        if (!dirty || saving || readOnly) {
            return;
        }
        vm.saveProjectSb3()
            .then(function (blob) {
                return blob.arrayBuffer();
            })
            .then(function (buffer) {
                var bytes = new Uint8Array(buffer);
                return hashHex(buffer).then(function (hash) {
                    return api('/api/v1/editor/projects/' + assignmentId + '/save-intents', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': readCookie('csrf_token')
                        },
                        body: JSON.stringify({isi_hash: hash, ukuran_bytes: bytes.length})
                    }).then(function (response) {
                        if (!response.ok) {
                            throw {status: response.status};
                        }
                        return response.json();
                    }).then(function (intent) {
                        saving = true;
                        return postSnapshot(bytes, 'manual', {saveIntentToken: intent.upload_token});
                    });
                });
            })
            .then(function (json) {
                saving = false;
                dirty = false;
                if (json && json.snapshot_id) {
                    lastSnapshotId = json.snapshot_id;
                }
                setStatus('Tersimpan');
            })
            .catch(function () {
                saving = false;
                setStatus('Belum tersimpan. Mencoba lagi.');
            });
    }

    function submitError(error) {
        if (error && error.kode === 'SNAPSHOT_SUDAH_DIKUMPULKAN') {
            return 'Karya ini sudah dikumpulkan sebelumnya.';
        }
        if (!error || error.status === undefined || error.status === 0) {
            return 'Koneksi terputus. Kumpulkan lagi setelah internetmu kembali.';
        }
        return 'Pengumpulan belum berhasil. Coba lagi ya.';
    }

    function onSubmitClick() {
        el.kumpul.disabled = true;
        setStatus('Mengumpulkan...');

        var chain = Promise.resolve();
        if (dirty && canEdit && !readOnly) {
            chain = doSave('manual').catch(function () {
                return null;
            });
        }

        chain
            .then(function () {
                return api('/api/v1/editor/projects/' + assignmentId + '/snapshots').then(function (response) {
                    return response.ok ? response.json() : {snapshots: []};
                });
            })
            .then(function (list) {
                var snapshot = list.snapshots && list.snapshots[0];
                if (!snapshot) {
                    throw {message: 'Belum ada proyek tersimpan untuk dikumpulkan.'};
                }
                var catatan = window.prompt('Ada catatan untuk gurumu? (boleh dikosongkan)', '');
                return api('/api/v1/assignments/' + assignmentId + '/submissions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': readCookie('csrf_token'),
                        'Idempotency-Key': genId()
                    },
                    body: JSON.stringify({snapshot_id: snapshot.id, catatan_siswa: catatan || ''})
                }).then(function (response) {
                    if (!response.ok) {
                        return response.json().then(function (body) {
                            throw body && body.error ? body.error : {status: response.status};
                        });
                    }
                    return response.json();
                });
            })
            .then(function () {
                setStatus('Sudah dikumpulkan. Terima kasih!');
                el.kumpul.disabled = false;
            })
            .catch(function (error) {
                setStatus(submitError(error));
                el.kumpul.disabled = false;
            });
    }

    function loadSession() {
        api('/api/v1/editor/session?assignment_id=' + encodeURIComponent(assignmentId))
            .then(function (response) {
                serverOffsetMs = computeOffset(response.headers.get('date'));
                if (response.status === 401) {
                    fatal('Kamu belum masuk', 'Masuk dulu untuk mengerjakan tugas ini.', APP + '/masuk');
                    return null;
                }
                if (response.status === 404) {
                    fatal('Tugas tidak ditemukan', 'Tugas ini tidak tersedia untukmu.', APP + '/tugas');
                    return null;
                }
                if (!response.ok) {
                    fatal('Tidak bisa membuka editor', 'Coba muat ulang sebentar lagi.');
                    return null;
                }
                return response.json();
            })
            .then(function (data) {
                if (!data) {
                    return;
                }
                info = data;
                var assignment = data.assignment || {};
                el.title.textContent = assignment.judul || 'Tugas';
                el.kumpul.hidden = false;
                el.kumpul.disabled = assignment.boleh_kumpul === false;

                whenShowing(function () {
                    if (assignment.status === 'belum_dibuka') {
                        setReadOnly(true);
                        showNotice('Tugas ini dibuka nanti. Kamu belum bisa mengerjakannya sekarang.');
                        setStatus('Belum bisa dikerjakan');
                        return;
                    }

                    loadLastProject(function () {
                        if (assignment.status === 'ditutup') {
                            setReadOnly(true);
                            setStatus('Tugas sudah ditutup (hanya baca)');
                            return;
                        }
                        canEdit = true;
                        el.save.hidden = false;
                        vm.on('PROJECT_CHANGED', onProjectChanged);
                        timers.force = setInterval(function () {
                            if (dirty && !saving) {
                                doSave('otomatis');
                            }
                        }, FORCE_SAVE_MS);
                        scheduleFinalization();
                        setStatus('Tersimpan');
                    });
                });
            });
    }

    function boot() {
        if (!GUI) {
            document.body.textContent = 'Editor gagal dimuat.';
            return;
        }

        el.bar = $('bar');
        el.title = $('bar-title');
        el.status = $('status');
        el.save = $('btn-save');
        el.kumpul = $('btn-kumpul');
        el.stage = $('stage');

        assignmentId = new URLSearchParams(location.search).get('assignment_id');
        el.bar.hidden = false;

        if (!assignmentId) {
            fatal('Tautan tidak lengkap', 'Buka editor dari halaman tugasmu.', APP + '/tugas');
            return;
        }

        el.kumpul.addEventListener('click', onSubmitClick);
        el.save.addEventListener('click', function () {
            doSave('manual').catch(function () {});
        });

        window.addEventListener('pagehide', function () {
            if (!dirty || readOnly || saving || !canEdit) {
                return;
            }
            vm.saveProjectSb3()
                .then(function (blob) {
                    var url =
                        APP +
                        '/api/v1/editor/projects/' +
                        assignmentId +
                        '/snapshots/beacon?jenis=otomatis&csrf=' +
                        encodeURIComponent(readCookie('csrf_token'));
                    try {
                        navigator.sendBeacon(url, blob);
                    } catch (error) {
                        // Diabaikan: keberhasilan tetap ditentukan server.
                    }
                })
                .catch(function () {});
        });

        mountEditor();
        setStatus('Memuat...');
        loadSession();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
