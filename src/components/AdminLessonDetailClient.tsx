'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {
    defaultChallengeConfig,
    validateChallengeConfig,
    type ChallengeConfig
} from '@/lib/challenge/engine';
import {defaultStoryConfig, validateStoryConfig, type StoryConfig} from '@/lib/story/schema';
import type {MediaAssetClientItem} from './AdminMediaClient';
import {ChallengeBuilder} from './ChallengeBuilder';
import {StoryBuilder} from './StoryBuilder';

export interface StageClientItem {
    id: string;
    urutan: number;
    judul: string;
    tipe: 'story' | 'challenge';
    config: Record<string, unknown>;
}

export function AdminLessonDetailClient({
    lessonId,
    stages,
    mediaAssets
}: {
    lessonId: string;
    stages: StageClientItem[];
    mediaAssets: MediaAssetClientItem[];
}) {
    const router = useRouter();
    const [selectedStageId, setSelectedStageId] = useState<string | null>(stages[0]?.id ?? null);
    const [addingType, setAddingType] = useState<'story' | 'challenge' | null>(null);
    const [error, setError] = useState('');

    const selectedStage = stages.find(s => s.id === selectedStageId) || stages[0] || null;

    async function handleAddStage(tipe: 'story' | 'challenge') {
        setAddingType(tipe);
        setError('');
        const nextNum = stages.length + 1;
        const judul =
            tipe === 'story'
                ? `Stage ${nextNum} — Cerita Petualang`
                : `Stage ${nextNum} — Tantangan Blok`;

        const res = await fetch(`/api/v1/admin/lessons/${lessonId}/stages`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                judul,
                tipe,
                config: tipe === 'story' ? defaultStoryConfig() : defaultChallengeConfig()
            })
        });
        const data = await res.json().catch(() => ({}));
        setAddingType(null);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal menambah stage.');
            return;
        }
        setSelectedStageId(data.stage.id);
        router.refresh();
    }

    async function handleMoveStage(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= stages.length) return;

        const ids = stages.map(s => s.id);
        const [moved] = ids.splice(index, 1);
        ids.splice(target, 0, moved);

        await fetch(`/api/v1/admin/lessons/${lessonId}/stages/reorder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({stage_ids: ids})
        });
        router.refresh();
    }

    async function handleDeleteStage(stageId: string) {
        await fetch(`/api/v1/admin/stages/${stageId}`, {method: 'DELETE'});
        if (selectedStageId === stageId) {
            setSelectedStageId(null);
        }
        router.refresh();
    }

    let safeStoryConfig: StoryConfig = defaultStoryConfig();
    if (selectedStage?.tipe === 'story') {
        try {
            safeStoryConfig = validateStoryConfig(selectedStage.config);
        } catch {
            safeStoryConfig = defaultStoryConfig();
        }
    }

    let safeChallengeConfig: ChallengeConfig = defaultChallengeConfig();
    if (selectedStage?.tipe === 'challenge') {
        try {
            safeChallengeConfig = validateChallengeConfig(selectedStage.config);
        } catch {
            safeChallengeConfig = defaultChallengeConfig();
        }
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[310px_1fr]">
            {/* KOLOM KIRI: DAFTAR STAGE */}
            <aside className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
                <div>
                    <h2 className="text-base font-black" style={{color: 'var(--navy)'}}>
                        Urutan Stage ({stages.length})
                    </h2>
                    <p className="text-xs font-semibold text-slate-500">
                        Atur urutan cerita &amp; tantangan yang akan ditampilkan ke siswa.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={addingType !== null}
                        onClick={() => handleAddStage('story')}
                        className="rounded-xl px-3 py-2 text-xs font-black text-white"
                        style={{background: 'var(--teal)'}}
                    >
                        + Stage Cerita
                    </button>
                    <button
                        type="button"
                        disabled={addingType !== null}
                        onClick={() => handleAddStage('challenge')}
                        className="rounded-xl px-3 py-2 text-xs font-black text-white"
                        style={{background: 'var(--navy)'}}
                    >
                        + Stage Challenge
                    </button>
                </div>

                {error && (
                    <p role="status" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        {error}
                    </p>
                )}

                {stages.length === 0 ? (
                    <p className="py-4 text-xs font-semibold text-slate-500">
                        Belum ada stage pada pelajaran ini. Klik salah satu tombol di atas untuk
                        menambahkan Stage 1.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {stages.map((st, idx) => {
                            const active = selectedStage?.id === st.id;
                            return (
                                <li
                                    key={st.id}
                                    className={`rounded-xl border-2 p-3 transition ${
                                        active
                                            ? 'border-[#04a5ad] bg-teal-50/50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedStageId(st.id)}
                                            className="flex-1 text-left"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="rounded px-2 py-0.5 text-[10px] font-black uppercase text-white"
                                                    style={{
                                                        background:
                                                            st.tipe === 'story'
                                                                ? 'var(--teal)'
                                                                : 'var(--coral)'
                                                    }}
                                                >
                                                    Stage {st.urutan} ·{' '}
                                                    {st.tipe === 'story' ? 'Cerita' : 'Challenge'}
                                                </span>
                                            </div>
                                            <div
                                                className="mt-1 text-sm font-black"
                                                style={{color: 'var(--navy)'}}
                                            >
                                                {st.judul}
                                            </div>
                                        </button>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={() => handleMoveStage(idx, -1)}
                                                title="Geser naik"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-extrabold text-slate-700 disabled:opacity-30"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                disabled={idx === stages.length - 1}
                                                onClick={() => handleMoveStage(idx, 1)}
                                                title="Geser turun"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-extrabold text-slate-700 disabled:opacity-30"
                                            >
                                                ↓
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteStage(st.id)}
                                                title="Hapus stage"
                                                className="rounded px-1.5 py-0.5 text-xs font-extrabold text-rose-600 hover:bg-rose-50"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </aside>

            {/* KOLOM KANAN: EDITOR STAGE TERPILIH */}
            <section className="rounded-2xl border-2 border-slate-200 bg-white p-6">
                {!selectedStage ? (
                    <div className="py-16 text-center text-sm font-semibold text-slate-500">
                        Pilih atau tambahkan stage di sebelah kiri untuk mulai menyunting.
                    </div>
                ) : selectedStage.tipe === 'story' ? (
                    <StoryBuilder
                        key={selectedStage.id}
                        stageId={selectedStage.id}
                        initialJudul={selectedStage.judul}
                        initialConfig={safeStoryConfig}
                        mediaAssets={mediaAssets}
                        onSaved={() => router.refresh()}
                    />
                ) : (
                    <ChallengeBuilder
                        key={selectedStage.id}
                        stageId={selectedStage.id}
                        initialJudul={selectedStage.judul}
                        initialConfig={safeChallengeConfig}
                        mediaAssets={mediaAssets}
                        onSaved={() => router.refresh()}
                    />
                )}
            </section>
        </div>
    );
}
