'use client';

import {useCallback, useEffect, useState} from 'react';
import {
    defaultChallengeConfig,
    validateChallengeConfig,
    type ChallengeAction,
    type ChallengeEvaluationResult
} from '@/lib/challenge/engine';
import {defaultStoryConfig, validateStoryConfig} from '@/lib/story/schema';
import type {LiveSessionStatePayload} from '@/server/live-sessions';
import {ChallengePlayer} from './ChallengePlayer';
import {StoryPlayer} from './StoryPlayer';

export function StudentLiveRoomClient({
    classId,
    kelasNama,
    studentName,
    initialSession
}: {
    classId: string;
    kelasNama: string;
    studentName: string;
    initialSession: LiveSessionStatePayload | null;
}) {
    const [session, setSession] = useState<LiveSessionStatePayload | null>(initialSession);
    const [sessionFull, setSessionFull] = useState(false);
    const [connected, setConnected] = useState(false);
    const [syncNote, setSyncNote] = useState('');

    // Koneksi WebSocket yang mengunci layar siswa mengikuti stage aktif Admin
    useEffect(() => {
        let closed = false;
        let ws: WebSocket | null = null;
        let retryTimer = 0;
        let pingTimer = 0;
        let retryAttempt = 0;

        const activeSessionId = session?.status === 'active' ? session.session_id : null;
        const query = activeSessionId
            ? `session_id=${encodeURIComponent(activeSessionId)}`
            : `class_id=${encodeURIComponent(classId)}`;

        function connect() {
            if (closed) return;
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${proto}//${window.location.host}/ws?${query}`);

            ws.onopen = () => {
                if (!closed) {
                    retryAttempt = 0;
                    setConnected(true);
                    setSessionFull(false);
                    window.clearInterval(pingTimer);
                    pingTimer = window.setInterval(() => {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({type: 'ping'}));
                        }
                    }, 20_000);
                }
            };

            ws.onmessage = ev => {
                try {
                    const msg = JSON.parse(String(ev.data));
                    if (msg?.type === 'session:state' && msg.payload) {
                        setSession(msg.payload as LiveSessionStatePayload);
                        setSessionFull(false);
                    } else if (msg?.type === 'session:ended') {
                        setSession(null);
                    }
                } catch {}
            };

            ws.onclose = ev => {
                window.clearInterval(pingTimer);
                if (closed) return;
                setConnected(false);
                if (ev.code === 4009) {
                    setSessionFull(true);
                    return;
                }
                const backoffMs = Math.min(8000, 1000 * Math.pow(1.5, retryAttempt));
                retryAttempt += 1;
                retryTimer = window.setTimeout(async () => {
                    try {
                        const res = await fetch(`/api/v1/student/classes/${classId}/live`);
                        if (res.ok) {
                            const data = await res.json();
                            setSession(data?.session ?? null);
                        }
                    } catch {}
                    connect();
                }, backoffMs);
            };
        }

        connect();

        return () => {
            closed = true;
            window.clearTimeout(retryTimer);
            window.clearInterval(pingTimer);
            ws?.close();
        };
    }, [classId, session?.session_id, session?.status]);

    const handleChallengeRunComplete = useCallback(
        async ({
            actions,
            result
        }: {
            actions: ChallengeAction[];
            result: ChallengeEvaluationResult;
        }) => {
            if (!session || session.status !== 'active') return;
            setSyncNote('Mengirim hasil percobaan ke guru…');
            try {
                const res = await fetch(
                    `/api/v1/live-sessions/${encodeURIComponent(session.session_id)}/progress`,
                    {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            stage_id: session.active_stage.id,
                            actions
                        })
                    }
                );
                if (res.ok) {
                    setSyncNote(
                        result.completed
                            ? 'Hasilmu sudah tercatat di layar guru! ★'
                            : 'Percobaanmu tercatat. Ayo coba lagi sampai berhasil!'
                    );
                } else {
                    const data = await res.json().catch(() => ({}));
                    setSyncNote(data?.error?.pesan || '');
                }
            } catch {
                setSyncNote('');
            }
        },
        [session]
    );

    if (sessionFull) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                <div className="rounded-3xl border-2 border-rose-200 bg-white p-10 shadow-sm">
                    <img
                        src="/mascot/pose-ui/05-pose-berpikir-debugging.jpg"
                        alt="Kelas sedang penuh"
                        className="mx-auto h-36 w-36 rounded-full border-4 border-[#1e2d5a] object-cover"
                    />
                    <h1 className="mt-4 text-2xl font-black" style={{color: 'var(--navy)'}}>
                        Kelas Sedang Penuh (Maksimal 20 Siswa)
                    </h1>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                        Sesi kelas <strong>{kelasNama}</strong> sudah mencapai batas maksimal 20
                        siswa aktif. Silakan beri tahu gurumu ya.
                    </p>
                </div>
            </div>
        );
    }

    if (!session || session.status !== 'active') {
        return (
            <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                <div className="rounded-3xl border-2 border-slate-200 bg-white p-10 shadow-sm">
                    <img
                        src="/mascot/pose-ui/07-pose-menyapa-onboarding.jpg"
                        alt="Kelinci Penjelajah menyapa"
                        className="mx-auto h-40 w-40 rounded-full border-4 border-[#1e2d5a] object-cover"
                    />
                    <span
                        className="mt-4 inline-block rounded-full px-3.5 py-1 text-xs font-extrabold text-white"
                        style={{background: 'var(--teal)'}}
                    >
                        Ruang Kelas Live · {kelasNama}
                    </span>
                    <h1 className="mt-3 text-2xl font-black" style={{color: 'var(--navy)'}}>
                        Halo, {studentName}!
                    </h1>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                        Menunggu pengajar memulai pelajaran… Saat sesi dimulai, layar ini akan
                        otomatis menampilkan cerita dan tantangan sesuai arahan gurumu.
                    </p>
                </div>
            </div>
        );
    }

    let storyConfig = defaultStoryConfig();
    let challengeConfig = defaultChallengeConfig();
    if (session.active_stage.tipe === 'story') {
        try {
            storyConfig = validateStoryConfig(session.active_stage.config);
        } catch {}
    } else {
        try {
            challengeConfig = validateChallengeConfig(session.active_stage.config);
        } catch {}
    }

    return (
        <div className="mx-auto max-w-5xl px-6 py-6">
            {/* Header Stage Aktif (Terkunci mengikuti Admin — tidak ada tombol loncat stage) */}
            <div
                className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-white shadow-xs"
                style={{background: 'var(--navy)'}}
            >
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className="rounded-full px-3 py-1 text-xs font-black text-slate-900"
                        style={{background: 'var(--amber)'}}
                    >
                        Stage {session.active_stage.urutan} dari {session.active_stage.total_stages}
                    </span>
                    <div>
                        <div className="text-xs font-bold text-white/70">
                            {session.lesson_judul}
                        </div>
                        <h1 className="text-lg font-black">{session.active_stage.judul}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-extrabold">
                    <span
                        className={`h-2.5 w-2.5 rounded-full ${
                            connected ? 'bg-[#7ed957]' : 'bg-amber-400'
                        }`}
                    />
                    <span className="text-white/85">
                        {connected ? 'Tersinkron dengan layar guru' : 'Menyambungkan ulang…'}
                    </span>
                </div>
            </div>

            {session.active_stage.tipe === 'story' ? (
                <div className="space-y-3">
                    <StoryPlayer
                        config={storyConfig}
                        showControls={false}
                        externalPlayback={{
                            status: session.playback.status,
                            offset_ms: session.playback.offset_ms,
                            updated_at_ms:
                                Date.now() -
                                Math.max(
                                    0,
                                    session.playback.server_time_ms -
                                        session.playback.updated_at_ms
                                )
                        }}
                    />
                    <p className="text-center text-xs font-extrabold text-slate-500">
                        {session.playback.status === 'playing'
                            ? '♪ Cerita sedang diputar oleh gurumu…'
                            : 'Perhatikan layar! Gurumu yang mengendalikan jalannya cerita.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <ChallengePlayer
                        key={session.active_stage.id}
                        config={challengeConfig}
                        locked={session.challenge_locked}
                        onRunComplete={handleChallengeRunComplete}
                    />
                    {syncNote && (
                        <p
                            role="status"
                            className="text-center text-xs font-extrabold"
                            style={{color: 'var(--teal-dark)'}}
                        >
                            {syncNote}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
