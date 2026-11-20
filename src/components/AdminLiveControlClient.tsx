'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {defaultChallengeConfig, validateChallengeConfig} from '@/lib/challenge/engine';
import {defaultStoryConfig, validateStoryConfig} from '@/lib/story/schema';
import type {LiveSessionStatePayload} from '@/server/live-sessions';
import {ChallengePlayer} from './ChallengePlayer';
import {StoryPlayer} from './StoryPlayer';

export interface LiveStudentMonitorItem {
    id: string;
    nama: string;
    username: string;
    online: boolean;
    progress_status: 'in_progress' | 'completed' | null;
    attempts: number;
    blocks_used: number | null;
    completed_at: string | null;
}

export function AdminLiveControlClient({
    initialState,
    stages,
    initialStudents
}: {
    initialState: LiveSessionStatePayload;
    stages: Array<{id: string; urutan: number; judul: string; tipe: 'story' | 'challenge'}>;
    initialStudents: LiveStudentMonitorItem[];
}) {
    const router = useRouter();
    const [state, setState] = useState<LiveSessionStatePayload>(initialState);
    const [students, setStudents] = useState<LiveStudentMonitorItem[]>(initialStudents);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const endDialogRef = useRef<HTMLDialogElement | null>(null);

    async function refreshSessionDetail() {
        try {
            const res = await fetch(`/api/v1/admin/live-sessions/${state.session_id}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data?.state) setState(data.state);
            if (Array.isArray(data?.students)) setStudents(data.students);
        } catch {}
    }

    // Koneksi WebSocket untuk menerima presence dan progres siswa real-time
    useEffect(() => {
        let closed = false;
        let ws: WebSocket | null = null;
        let retryTimer = 0;

        function connect() {
            if (closed) return;
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(
                `${proto}//${window.location.host}/ws?session_id=${encodeURIComponent(state.session_id)}`
            );

            ws.onmessage = ev => {
                try {
                    const msg = JSON.parse(String(ev.data));
                    if (msg?.type === 'session:state' && msg.payload) {
                        setState(msg.payload as LiveSessionStatePayload);
                    } else if (msg?.type === 'session:presence' && Array.isArray(msg.payload?.connected_student_ids)) {
                        const onlineSet = new Set<string>(msg.payload.connected_student_ids);
                        setStudents(prev =>
                            prev.map(s => ({
                                ...s,
                                online: onlineSet.has(s.id)
                            }))
                        );
                    } else if (msg?.type === 'student:progress' && msg.payload) {
                        const p = msg.payload as {
                            student_id: string;
                            stage_id: string;
                            status: 'in_progress' | 'completed';
                            attempts: number;
                            blocks_used: number;
                        };
                        setStudents(prev =>
                            prev.map(s =>
                                s.id === p.student_id
                                    ? {
                                          ...s,
                                          progress_status: p.status,
                                          attempts: p.attempts,
                                          blocks_used: p.blocks_used
                                      }
                                    : s
                            )
                        );
                    } else if (msg?.type === 'session:ended') {
                        setState(prev => ({...prev, status: 'ended'}));
                    }
                } catch {}
            };

            ws.onclose = () => {
                if (!closed) {
                    retryTimer = window.setTimeout(connect, 2000);
                }
            };
        }

        connect();

        return () => {
            closed = true;
            window.clearTimeout(retryTimer);
            ws?.close();
        };
    }, [state.session_id]);

    async function sendControl(payload: Record<string, unknown>) {
        setBusy(true);
        setError('');
        const res = await fetch(`/api/v1/admin/live-sessions/${state.session_id}/control`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal mengirim perintah kontrol live.');
            return;
        }
        if (data?.state) {
            setState(data.state);
        }
        if (payload.action === 'set_stage') {
            await refreshSessionDetail();
        }
    }

    async function handleConfirmEndSession() {
        setBusy(true);
        await fetch(`/api/v1/admin/live-sessions/${state.session_id}/end`, {
            method: 'POST'
        });
        setBusy(false);
        router.push(`/admin/kelas/${state.class_id}`);
        router.refresh();
    }

    const currentIdx = stages.findIndex(s => s.id === state.active_stage.id);
    const prevStage = currentIdx > 0 ? stages[currentIdx - 1] : null;
    const nextStage =
        currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

    const onlineCount = students.filter(s => s.online).length;
    const completedCount = students.filter(s => s.progress_status === 'completed').length;

    let storyConfig = defaultStoryConfig();
    let challengeConfig = defaultChallengeConfig();
    if (state.active_stage.tipe === 'story') {
        try {
            storyConfig = validateStoryConfig(state.active_stage.config);
        } catch {}
    } else {
        try {
            challengeConfig = validateChallengeConfig(state.active_stage.config);
        } catch {}
    }

    return (
        <div className="space-y-6">
            {/* BAR KONTROL ATAS */}
            <section
                className="rounded-2xl border-2 p-5 text-white shadow-sm"
                style={{background: 'var(--navy)', borderColor: '#111a38'}}
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-black text-white"
                                style={{background: state.status === 'active' ? 'var(--teal)' : '#64748b'}}
                            >
                                <span className="h-2 w-2 rounded-full bg-white" />
                                {state.status === 'active' ? 'SESI LIVE AKTIF' : 'SESI BERAKHIR'}
                            </span>
                            <Link
                                href={`/admin/kelas/${state.class_id}`}
                                className="text-xs font-extrabold text-white/75 hover:text-white hover:underline"
                            >
                                {state.kelas_nama}
                            </Link>
                        </div>
                        <h1 className="mt-1 text-xl font-black">{state.lesson_judul}</h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={busy || !prevStage || state.status !== 'active'}
                            onClick={() =>
                                prevStage &&
                                sendControl({action: 'set_stage', stage_id: prevStage.id})
                            }
                            className="rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-white/20 disabled:opacity-35"
                        >
                            ← Stage Sebelumnya
                        </button>
                        <button
                            type="button"
                            disabled={busy || !nextStage || state.status !== 'active'}
                            onClick={() =>
                                nextStage &&
                                sendControl({action: 'set_stage', stage_id: nextStage.id})
                            }
                            className="rounded-xl px-4 py-2 text-xs font-black text-slate-900 disabled:opacity-35"
                            style={{background: 'var(--amber)'}}
                        >
                            Stage Berikutnya →
                        </button>
                        <button
                            type="button"
                            disabled={busy || state.status !== 'active'}
                            onClick={() => endDialogRef.current?.showModal()}
                            className="rounded-xl px-4 py-2 text-xs font-black text-white"
                            style={{background: 'var(--coral)'}}
                        >
                            Akhiri Sesi
                        </button>
                    </div>
                </div>

                {/* Pil Navigasi Langsung ke Stage */}
                <div className="mt-4 flex flex-wrap gap-2">
                    {stages.map(st => {
                        const active = st.id === state.active_stage.id;
                        return (
                            <button
                                key={st.id}
                                type="button"
                                disabled={busy || state.status !== 'active'}
                                onClick={() => sendControl({action: 'set_stage', stage_id: st.id})}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                                    active
                                        ? 'bg-[#04a5ad] text-white shadow-xs ring-2 ring-[#F5A623]'
                                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                                }`}
                            >
                                Stage {st.urutan}: {st.judul} (
                                {st.tipe === 'story' ? 'Cerita' : 'Challenge'})
                            </button>
                        );
                    })}
                </div>

                {/* Kontrol Spesifik Stage Aktif (Cerita vs Challenge) */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/25 px-4 py-3">
                    <div className="text-xs font-extrabold text-white/90">
                        Layar Siswa Saat Ini:{' '}
                        <strong className="text-[#F5A623]">
                            Stage {state.active_stage.urutan} — {state.active_stage.judul}
                        </strong>
                    </div>

                    {state.active_stage.tipe === 'story' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    sendControl({
                                        action: 'playback',
                                        playback_status: 'playing',
                                        offset_ms: 0
                                    })
                                }
                                className="rounded-lg px-3.5 py-1.5 text-xs font-black text-white"
                                style={{background: 'var(--teal)'}}
                            >
                                ▶ Putar Cerita di Layar Siswa
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    sendControl({
                                        action: 'playback',
                                        playback_status: 'paused',
                                        offset_ms: state.playback.offset_ms
                                    })
                                }
                                className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-white/20"
                            >
                                ⏸ Jeda
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    sendControl({
                                        action: 'playback',
                                        playback_status: 'idle',
                                        offset_ms: 0
                                    })
                                }
                                className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-white/20"
                            >
                                ↺ Reset ke Awal
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-white/80">
                                Status Papan Blok Siswa:{' '}
                                <strong>
                                    {state.challenge_locked
                                        ? '🔒 Terkunci (Mode Penjelasan)'
                                        : '🔓 Terbuka (Siswa Bisa Mengerjakan)'}
                                </strong>
                            </span>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    sendControl({
                                        action: 'set_lock',
                                        challenge_locked: !state.challenge_locked
                                    })
                                }
                                className="rounded-lg px-3.5 py-1.5 text-xs font-black text-slate-900"
                                style={{
                                    background: state.challenge_locked
                                        ? 'var(--green)'
                                        : 'var(--amber)'
                                }}
                            >
                                {state.challenge_locked
                                    ? '🔓 Buka Interaksi Siswa'
                                    : '🔒 Kunci Interaksi Siswa'}
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <p
                        role="status"
                        className="mt-3 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-200"
                    >
                        {error}
                    </p>
                )}
            </section>

            {/* AREA UTAMA: PRATINJAU STAGE & PEMANTAU 20 SISWA */}
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <section className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                    <h2
                        className="mb-3 text-sm font-black uppercase tracking-wider"
                        style={{color: 'var(--navy)'}}
                    >
                        Pratinjau Layar Siswa
                    </h2>
                    {state.active_stage.tipe === 'story' ? (
                        <StoryPlayer
                            config={storyConfig}
                            showControls
                            externalPlayback={{
                                status: state.playback.status,
                                offset_ms: state.playback.offset_ms,
                                updated_at_ms:
                                    Date.now() -
                                    Math.max(
                                        0,
                                        state.playback.server_time_ms -
                                            state.playback.updated_at_ms
                                    )
                            }}
                        />
                    ) : (
                        <ChallengePlayer
                            config={challengeConfig}
                            locked={state.challenge_locked}
                        />
                    )}
                </section>

                <section className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-base font-black" style={{color: 'var(--navy)'}}>
                                Pemantau Layar Siswa Real-Time
                            </h2>
                            <p className="text-xs font-semibold text-slate-500">
                                Kapasitas sesi: maksimal {state.maks_siswa} siswa bersamaan.
                            </p>
                        </div>
                        <div className="flex gap-2 text-xs font-extrabold">
                            <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-900">
                                Online: {onlineCount}/{state.maks_siswa}
                            </span>
                            {state.active_stage.tipe === 'challenge' && (
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
                                    Selesai: {completedCount}/{students.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {students.length === 0 ? (
                        <p className="text-sm font-semibold text-slate-500">
                            Belum ada siswa yang terdaftar di kelas ini.
                        </p>
                    ) : (
                        <ul className="grid gap-2.5 sm:grid-cols-2">
                            {students.map(st => (
                                <li
                                    key={st.id}
                                    data-student-monitor={st.username}
                                    className={`rounded-xl border-2 p-3 transition ${
                                        st.progress_status === 'completed'
                                            ? 'border-emerald-300 bg-emerald-50/70'
                                            : st.online
                                              ? 'border-teal-200 bg-teal-50/30'
                                              : 'border-slate-200 bg-slate-50/60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`h-2.5 w-2.5 rounded-full ${
                                                    st.online ? 'bg-emerald-500' : 'bg-slate-300'
                                                }`}
                                                title={st.online ? 'Terhubung' : 'Luring'}
                                            />
                                            <div>
                                                <div
                                                    className="text-xs font-black"
                                                    style={{color: 'var(--navy)'}}
                                                >
                                                    {st.nama}
                                                </div>
                                                <div className="font-mono text-[11px] font-bold text-slate-500">
                                                    @{st.username}
                                                </div>
                                            </div>
                                        </div>

                                        {state.active_stage.tipe === 'challenge' && (
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                                    st.progress_status === 'completed'
                                                        ? 'bg-emerald-600 text-white'
                                                        : st.attempts > 0
                                                          ? 'bg-amber-200 text-amber-950'
                                                          : 'bg-slate-200 text-slate-600'
                                                }`}
                                            >
                                                {st.progress_status === 'completed'
                                                    ? 'Selesai ✓'
                                                    : st.attempts > 0
                                                      ? `${st.attempts}x coba`
                                                      : 'Belum coba'}
                                            </span>
                                        )}
                                    </div>

                                    {state.active_stage.tipe === 'challenge' &&
                                        st.blocks_used !== null && (
                                            <div className="mt-1.5 text-[11px] font-bold text-slate-600">
                                                Blok dipakai: {st.blocks_used} blok
                                            </div>
                                        )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {/* Dialog Konfirmasi Akhiri Sesi (sesuai modern-web-guidance `dialog`) */}
            <dialog
                ref={endDialogRef}
                aria-labelledby="end-session-dialog-title"
                onClose={e => {
                    const dlg = e.currentTarget;
                    const val = dlg.returnValue;
                    dlg.returnValue = '';
                    if (val === 'confirm') {
                        handleConfirmEndSession();
                    }
                }}
                className="m-auto max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 text-slate-900 shadow-xl"
            >
                <h2
                    id="end-session-dialog-title"
                    className="text-lg font-black"
                    style={{color: 'var(--navy)'}}
                >
                    Akhiri Sesi Live Sekarang?
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                    Seluruh layar siswa yang terhubung akan dikembalikan ke ruang tunggu kelas.
                    Progres tantangan yang sudah dicatat tetap tersimpan.
                </p>
                <form method="dialog" className="mt-5 flex justify-end gap-2.5">
                    <button
                        value="cancel"
                        autoFocus
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                    >
                        Batal
                    </button>
                    <button
                        value="confirm"
                        className="rounded-xl px-4 py-2 text-xs font-black text-white"
                        style={{background: 'var(--coral)'}}
                    >
                        Ya, Akhiri Sesi
                    </button>
                </form>
            </dialog>
        </div>
    );
}
