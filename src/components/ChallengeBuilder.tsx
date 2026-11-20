'use client';

import {useRef, useState} from 'react';
import {
    type ChallengeBlockType,
    type ChallengeConfig,
    type Direction,
    type GridPoint
} from '@/lib/challenge/engine';
import type {MediaAssetClientItem} from './AdminMediaClient';
import {ChallengePlayer} from './ChallengePlayer';

type BrushTool = 'start' | 'goal' | 'wall' | 'hazard' | 'star' | 'erase';

const BRUSH_TOOLS: Array<{key: BrushTool; label: string; icon: string}> = [
    {key: 'start', label: 'Posisi Awal', icon: '🐰'},
    {key: 'goal', label: 'Bendera Tujuan', icon: '🏁'},
    {key: 'wall', label: 'Rintangan Batu', icon: '🪨'},
    {key: 'hazard', label: 'Sungai (Lompat)', icon: '🌊'},
    {key: 'star', label: 'Bintang', icon: '⭐'},
    {key: 'erase', label: 'Hapus Petak', icon: '🟩'}
];

const BLOCK_OPTIONS: Array<{type: ChallengeBlockType; label: string}> = [
    {type: 'move', label: '→ MAJU (1–10 langkah)'},
    {type: 'turn_left', label: '↶ BELOK KIRI'},
    {type: 'turn_right', label: '↷ BELOK KANAN'},
    {type: 'jump', label: '⤴ LOMPAT (Melewati sungai)'},
    {type: 'collect', label: '⭐ AMBIL BINTANG'},
    {type: 'repeat', label: '↻ ULANGI N KALI'}
];

function samePoint(a: GridPoint, b: GridPoint): boolean {
    return a.x === b.x && a.y === b.y;
}

export function ChallengeBuilder({
    stageId,
    initialJudul,
    initialConfig,
    mediaAssets,
    onSaved
}: {
    stageId: string;
    initialJudul: string;
    initialConfig: ChallengeConfig;
    mediaAssets: MediaAssetClientItem[];
    onSaved: () => void;
}) {
    const [judul, setJudul] = useState(initialJudul);
    const [config, setConfig] = useState<ChallengeConfig>(initialConfig);
    const [tool, setTool] = useState<BrushTool>('wall');
    const [activeToolIdx, setActiveToolIdx] = useState(2);
    const [showTestPlay, setShowTestPlay] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const brushToolbarRef = useRef<HTMLDivElement | null>(null);

    const audioAssets = mediaAssets.filter(m => m.jenis === 'audio');

    function handleBrushToolbarKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if ('focusGroup' in HTMLElement.prototype) return;
        const count = BRUSH_TOOLS.length;
        let nextIdx = activeToolIdx;
        if (event.key === 'ArrowRight') {
            nextIdx = (activeToolIdx + 1) % count;
        } else if (event.key === 'ArrowLeft') {
            nextIdx = (activeToolIdx - 1 + count) % count;
        } else if (event.key === 'Home') {
            nextIdx = 0;
        } else if (event.key === 'End') {
            nextIdx = count - 1;
        } else {
            return;
        }
        event.preventDefault();
        setActiveToolIdx(nextIdx);
        const buttons =
            brushToolbarRef.current?.querySelectorAll<HTMLButtonElement>('button[data-brush-item]');
        buttons?.[nextIdx]?.focus();
    }

    function applyBrushAt(x: number, y: number) {
        const pt = {x, y};
        setConfig(prev => {
            const withoutCell = {
                ...prev,
                walls: prev.walls.filter(p => !samePoint(p, pt)),
                hazards: prev.hazards.filter(p => !samePoint(p, pt)),
                stars: prev.stars.filter(p => !samePoint(p, pt))
            };

            if (tool === 'erase') {
                return withoutCell;
            }
            if (tool === 'start') {
                if (samePoint(prev.goal, pt)) return prev;
                return {
                    ...withoutCell,
                    start: {...prev.start, x, y}
                };
            }
            if (tool === 'goal') {
                if (samePoint(prev.start, pt)) return prev;
                return {
                    ...withoutCell,
                    goal: {x, y}
                };
            }
            if (samePoint(prev.start, pt) || samePoint(prev.goal, pt)) {
                return prev;
            }
            if (tool === 'wall') {
                return {...withoutCell, walls: [...withoutCell.walls, pt]};
            }
            if (tool === 'hazard') {
                return {...withoutCell, hazards: [...withoutCell.hazards, pt]};
            }
            if (tool === 'star') {
                return {...withoutCell, stars: [...withoutCell.stars, pt]};
            }
            return prev;
        });
    }

    function toggleAllowedBlock(blockType: ChallengeBlockType) {
        setConfig(prev => {
            const exists = prev.allowed_blocks.includes(blockType);
            if (exists && prev.allowed_blocks.length <= 1) {
                return prev;
            }
            const next = exists
                ? prev.allowed_blocks.filter(b => b !== blockType)
                : [...prev.allowed_blocks, blockType];
            return {...prev, allowed_blocks: next};
        });
    }

    async function handleSave() {
        setSaving(true);
        setError('');
        setMessage('');

        const res = await fetch(`/api/v1/admin/stages/${stageId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({judul, config})
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);

        if (!res.ok) {
            setError(data?.error?.pesan || 'Gagal menyimpan stage challenge.');
            return;
        }
        setMessage('Stage challenge & peta berhasil disimpan ✓');
        onSaved();
    }

    const wallSet = new Set(config.walls.map(p => `${p.x},${p.y}`));
    const hazardSet = new Set(config.hazards.map(p => `${p.x},${p.y}`));
    const starSet = new Set(config.stars.map(p => `${p.x},${p.y}`));

    return (
        <div className="space-y-6">
            {/* Header & Toggle Mode Uji Stage */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                    <h3 className="text-base font-black" style={{color: 'var(--navy)'}}>
                        Editor Stage Challenge (Peta 2D &amp; Blok Visual)
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                        Rancang labirin CodeMonkey, pilih blok yang diizinkan, lalu uji langsung.
                    </p>
                </div>
                <button
                    type="button"
                    aria-pressed={showTestPlay}
                    onClick={() => setShowTestPlay(prev => !prev)}
                    className="rounded-xl px-4 py-2 text-xs font-black text-white"
                    style={{background: showTestPlay ? 'var(--navy)' : 'var(--teal)'}}
                >
                    {showTestPlay ? '← Kembali ke Editor Peta' : '▶ Uji Stage Sekarang'}
                </button>
            </div>

            {showTestPlay ? (
                <div className="rounded-2xl border-2 border-[#04a5ad] bg-teal-50/30 p-4">
                    <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[#037d84]">
                        Mode Uji Stage (Simulasi Siswa)
                    </div>
                    <ChallengePlayer config={config} />
                </div>
            ) : (
                <>
                    {/* Pengaturan Dasar Misi & Ukuran Grid */}
                    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                            <label
                                htmlFor="chal-judul"
                                className="mb-1 block text-xs font-extrabold"
                                style={{color: 'var(--navy)'}}
                            >
                                Judul Stage Challenge
                            </label>
                            <input
                                id="chal-judul"
                                type="text"
                                value={judul}
                                onChange={e => setJudul(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="chal-cols"
                                className="mb-1 block text-xs font-extrabold"
                                style={{color: 'var(--navy)'}}
                            >
                                Lebar Peta (Kolom 3–12)
                            </label>
                            <input
                                id="chal-cols"
                                type="number"
                                min={3}
                                max={12}
                                value={config.cols}
                                onChange={e => {
                                    const cols = Math.max(3, Math.min(12, Number(e.target.value) || 5));
                                    setConfig(prev => ({
                                        ...prev,
                                        cols,
                                        start: {
                                            ...prev.start,
                                            x: Math.min(prev.start.x, cols - 1)
                                        },
                                        goal: {
                                            ...prev.goal,
                                            x: Math.min(prev.goal.x, cols - 1)
                                        }
                                    }));
                                }}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="chal-rows"
                                className="mb-1 block text-xs font-extrabold"
                                style={{color: 'var(--navy)'}}
                            >
                                Tinggi Peta (Baris 3–10)
                            </label>
                            <input
                                id="chal-rows"
                                type="number"
                                min={3}
                                max={10}
                                value={config.rows}
                                onChange={e => {
                                    const rows = Math.max(3, Math.min(10, Number(e.target.value) || 5));
                                    setConfig(prev => ({
                                        ...prev,
                                        rows,
                                        start: {
                                            ...prev.start,
                                            y: Math.min(prev.start.y, rows - 1)
                                        },
                                        goal: {
                                            ...prev.goal,
                                            y: Math.min(prev.goal.y, rows - 1)
                                        }
                                    }));
                                }}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label
                                htmlFor="chal-instruction"
                                className="mb-1 block text-xs font-extrabold"
                                style={{color: 'var(--navy)'}}
                            >
                                Petunjuk Misi untuk Siswa
                            </label>
                            <input
                                id="chal-instruction"
                                type="text"
                                value={config.instruction}
                                onChange={e =>
                                    setConfig(prev => ({...prev, instruction: e.target.value}))
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="chal-ideal"
                                className="mb-1 block text-xs font-extrabold"
                                style={{color: 'var(--navy)'}}
                            >
                                Target Blok Ideal (⭐⭐⭐)
                            </label>
                            <input
                                id="chal-ideal"
                                type="number"
                                min={1}
                                max={50}
                                value={config.ideal_blocks}
                                onChange={e =>
                                    setConfig(prev => ({
                                        ...prev,
                                        ideal_blocks: Math.max(1, Number(e.target.value) || 4)
                                    }))
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                            />
                        </div>
                    </div>

                    {/* Editor Peta Visual + Pilihan Blok */}
                    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                        {/* KIRI: KANVAS PETA KLIK-PETAK */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-black" style={{color: 'var(--navy)'}}>
                                    Susun Peta Labirin (Klik Petak)
                                </h4>
                                <div className="flex items-center gap-1.5">
                                    <label
                                        htmlFor="start-dir"
                                        className="text-xs font-extrabold text-slate-600"
                                    >
                                        Arah Awal:
                                    </label>
                                    <select
                                        id="start-dir"
                                        value={config.start.dir}
                                        onChange={e =>
                                            setConfig(prev => ({
                                                ...prev,
                                                start: {
                                                    ...prev.start,
                                                    dir: e.target.value as Direction
                                                }
                                            }))
                                        }
                                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold"
                                    >
                                        <option value="E">Timur (→)</option>
                                        <option value="S">Selatan (↓)</option>
                                        <option value="W">Barat (←)</option>
                                        <option value="N">Utara (↑)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Toolbar Kuas Peta (role="toolbar" + aria-pressed) */}
                            <div
                                ref={brushToolbarRef}
                                role="toolbar"
                                aria-label="Alat kuas peta challenge"
                                {...({focusgroup: 'toolbar wrap'} as any)}
                                onKeyDown={handleBrushToolbarKeyDown}
                                className="mb-4 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-2"
                            >
                                <div
                                    role="group"
                                    aria-label="Pilih elemen peta"
                                    className="flex flex-wrap gap-1.5"
                                >
                                    {BRUSH_TOOLS.map((b, idx) => (
                                        <button
                                            key={b.key}
                                            type="button"
                                            data-brush-item
                                            tabIndex={idx === activeToolIdx ? 0 : -1}
                                            onFocus={() => setActiveToolIdx(idx)}
                                            aria-pressed={tool === b.key}
                                            onClick={() => setTool(b.key)}
                                            className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition ${
                                                tool === b.key
                                                    ? 'bg-[#1e2d5a] text-white shadow-xs'
                                                    : 'bg-white text-slate-700 hover:bg-slate-200'
                                            }`}
                                        >
                                            {b.icon} {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Grid Klik */}
                            <div
                                className="mx-auto grid gap-1.5 rounded-2xl border-4 border-[#1e2d5a] bg-[#c8e6c9] p-2.5"
                                style={{
                                    gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
                                    maxWidth: 420
                                }}
                            >
                                {Array.from({length: config.rows}).map((_, ry) =>
                                    Array.from({length: config.cols}).map((__, cx) => {
                                        const key = `${cx},${ry}`;
                                        const isStart =
                                            config.start.x === cx && config.start.y === ry;
                                        const isGoal =
                                            config.goal.x === cx && config.goal.y === ry;
                                        const isWall = wallSet.has(key);
                                        const isHazard = hazardSet.has(key);
                                        const isStar = starSet.has(key);

                                        let tileBg = 'bg-[#e8f5e9] border-[#a5d6a7] hover:bg-[#dcedc8]';
                                        if (isWall) tileBg = 'bg-[#5d4037] border-[#3e2723] text-white';
                                        else if (isHazard)
                                            tileBg = 'bg-[#29b6f6] border-[#0288d1] text-white';
                                        else if (isGoal)
                                            tileBg = 'bg-[#fff3e0] border-[#F5A623]';

                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => applyBrushAt(cx, ry)}
                                                aria-label={`Petak ${cx},${ry}`}
                                                className={`relative flex aspect-square items-center justify-center rounded-xl border-2 text-lg sm:text-xl ${tileBg}`}
                                            >
                                                {isStart && <span>🐰</span>}
                                                {isGoal && <span>🏁</span>}
                                                {isWall && <span>🪨</span>}
                                                {isHazard && <span>🌊</span>}
                                                {isStar && <span>⭐</span>}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* KANAN: BLOK YANG DIIZINKAN & EFEK SUARA */}
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <h4
                                    className="mb-2 text-sm font-black"
                                    style={{color: 'var(--navy)'}}
                                >
                                    Blok Visual yang Diizinkan
                                </h4>
                                <div className="space-y-2">
                                    {BLOCK_OPTIONS.map(opt => (
                                        <label
                                            key={opt.type}
                                            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-800"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={config.allowed_blocks.includes(opt.type)}
                                                onChange={() => toggleAllowedBlock(opt.type)}
                                                className="h-4 w-4 accent-[#04a5ad]"
                                            />
                                            <span>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <h4
                                    className="mb-2 text-sm font-black"
                                    style={{color: 'var(--navy)'}}
                                >
                                    Efek Suara Stage (Bawaan / Pustaka)
                                </h4>
                                <div className="grid gap-2.5 sm:grid-cols-2">
                                    {(
                                        [
                                            {key: 'step', label: 'Suara Langkah'},
                                            {key: 'collect', label: 'Suara Ambil Bintang'},
                                            {key: 'win', label: 'Suara Menang'},
                                            {key: 'fail', label: 'Suara Gagal'}
                                        ] as const
                                    ).map(snd => (
                                        <div key={snd.key}>
                                            <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                {snd.label}
                                            </label>
                                            <select
                                                value={config.sounds[snd.key] || ''}
                                                onChange={e =>
                                                    setConfig(prev => ({
                                                        ...prev,
                                                        sounds: {
                                                            ...prev.sounds,
                                                            [snd.key]: e.target.value || null
                                                        }
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                            >
                                                <option value="">Nada Sintetis Bawaan</option>
                                                {audioAssets.map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.nama}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {error && (
                <p role="status" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                    {message}
                </p>
            )}

            <div className="flex justify-end">
                <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="rounded-xl px-6 py-3 text-sm font-black text-white"
                    style={{background: 'var(--coral)', boxShadow: '0 3px 0 var(--coral-dark)'}}
                >
                    {saving ? 'Menyimpan…' : 'Simpan Stage Challenge'}
                </button>
            </div>
        </div>
    );
}
