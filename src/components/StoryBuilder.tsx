'use client';

import {useState} from 'react';
import {
    type StoryActor,
    type StoryConfig,
    type StoryTimelineEvent
} from '@/lib/story/schema';
import type {MediaAssetClientItem} from './AdminMediaClient';
import {StoryPlayer} from './StoryPlayer';

const BUILTIN_SPRITES = [
    {label: 'Kelinci Penjelajah (Utama)', url: '/mascot/00-kelinci-penjelajah-utama.jpg'},
    {label: 'Kelinci Menyapa', url: '/mascot/pose-ui/07-pose-menyapa-onboarding.jpg'},
    {label: 'Kelinci Berpikir', url: '/mascot/pose-ui/05-pose-berpikir-debugging.jpg'},
    {label: 'Kelinci Selebrasi', url: '/mascot/pose-ui/06-pose-selebrasi-menang.jpg'},
    {label: 'Kelinci Flat Vektor', url: '/mascot/gaya-visual/01-gaya-flat-vektor.jpg'},
    {label: 'Kelinci Pixel Art', url: '/mascot/gaya-visual/03-gaya-pixel-art.jpg'}
];

const BUILTIN_SOUNDS = [
    {id: 'builtin:forest-chime', label: 'Nada Hutan (Bawaan)'},
    {id: 'builtin:victory', label: 'Nada Semangat (Bawaan)'}
];

export function StoryBuilder({
    stageId,
    initialJudul,
    initialConfig,
    mediaAssets,
    onSaved
}: {
    stageId: string;
    initialJudul: string;
    initialConfig: StoryConfig;
    mediaAssets: MediaAssetClientItem[];
    onSaved: () => void;
}) {
    const [judul, setJudul] = useState(initialJudul);
    const [config, setConfig] = useState<StoryConfig>(initialConfig);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const imageAssets = mediaAssets.filter(m => m.jenis === 'image');
    const audioAssets = mediaAssets.filter(m => m.jenis === 'audio');

    function updateActor(index: number, patch: Partial<StoryActor>) {
        setConfig(prev => ({
            ...prev,
            actors: prev.actors.map((a, i) => (i === index ? {...a, ...patch} : a))
        }));
    }

    function addActor() {
        const nextIdx = config.actors.length + 1;
        setConfig(prev => ({
            ...prev,
            actors: [
                ...prev.actors,
                {
                    id: `actor-${Date.now()}`,
                    name: `Karakter ${nextIdx}`,
                    asset_id: null,
                    sprite_url: BUILTIN_SPRITES[0].url,
                    initial_x: 25,
                    initial_y: 65,
                    scale: 1,
                    flip_x: false
                }
            ]
        }));
    }

    function removeActor(actorId: string) {
        if (config.actors.length <= 1) return;
        setConfig(prev => ({
            ...prev,
            actors: prev.actors.filter(a => a.id !== actorId),
            timeline: prev.timeline.filter(ev => !(ev.kind === 'move' && ev.actor_id === actorId))
        }));
    }

    function addMoveEvent() {
        const firstActor = config.actors[0];
        if (!firstActor) return;
        const newEv: StoryTimelineEvent = {
            id: `mv-${Date.now()}`,
            kind: 'move',
            start_ms: 0,
            end_ms: Math.min(3000, config.duration_ms),
            actor_id: firstActor.id,
            from_x: firstActor.initial_x,
            from_y: firstActor.initial_y,
            to_x: Math.min(85, firstActor.initial_x + 35),
            to_y: firstActor.initial_y,
            opacity: 1
        };
        setConfig(prev => ({...prev, timeline: [...prev.timeline, newEv]}));
    }

    function addDialogueEvent() {
        const firstActor = config.actors[0];
        const newEv: StoryTimelineEvent = {
            id: `dlg-${Date.now()}`,
            kind: 'dialogue',
            start_ms: 0,
            end_ms: Math.min(4000, config.duration_ms),
            actor_id: firstActor?.id ?? null,
            speaker: firstActor?.name || 'Kelinci Penjelajah',
            text: 'Ayo kita mulai petualangan hari ini!'
        };
        setConfig(prev => ({...prev, timeline: [...prev.timeline, newEv]}));
    }

    function addAudioEvent() {
        const defaultAudioId = audioAssets[0]?.id || BUILTIN_SOUNDS[0].id;
        const defaultLabel = audioAssets[0]?.nama || BUILTIN_SOUNDS[0].label;
        const newEv: StoryTimelineEvent = {
            id: `aud-${Date.now()}`,
            kind: 'audio',
            start_ms: 0,
            end_ms: Math.min(4000, config.duration_ms),
            asset_id: defaultAudioId,
            label: defaultLabel,
            volume: 0.85,
            loop: false
        };
        setConfig(prev => ({...prev, timeline: [...prev.timeline, newEv]}));
    }

    function updateEvent(index: number, patch: Record<string, unknown>) {
        setConfig(prev => ({
            ...prev,
            timeline: prev.timeline.map((ev, i) =>
                i === index ? ({...ev, ...patch} as StoryTimelineEvent) : ev
            )
        }));
    }

    function removeEvent(index: number) {
        setConfig(prev => ({
            ...prev,
            timeline: prev.timeline.filter((_, i) => i !== index)
        }));
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
            setError(data?.error?.pesan || 'Gagal menyimpan konfigurasi stage cerita.');
            return;
        }
        setMessage('Stage cerita & timeline berhasil disimpan ✓');
        onSaved();
    }

    return (
        <div className="space-y-6">
            {/* Pratinjau Panggung Langsung */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">
                        Pratinjau Panggung &amp; Timeline Cerita
                    </h3>
                    <span className="text-xs font-bold text-slate-500">
                        Durasi total: {(config.duration_ms / 1000).toFixed(1)} detik
                    </span>
                </div>
                <StoryPlayer config={config} showControls />
            </div>

            {/* Pengaturan Umum Stage Cerita */}
            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
                <div>
                    <label
                        htmlFor="story-judul"
                        className="mb-1 block text-xs font-extrabold"
                        style={{color: 'var(--navy)'}}
                    >
                        Judul Stage
                    </label>
                    <input
                        id="story-judul"
                        type="text"
                        value={judul}
                        onChange={e => setJudul(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                    />
                </div>
                <div>
                    <label
                        htmlFor="story-duration-sec"
                        className="mb-1 block text-xs font-extrabold"
                        style={{color: 'var(--navy)'}}
                    >
                        Durasi Stage (Detik)
                    </label>
                    <input
                        id="story-duration-sec"
                        type="number"
                        min={1}
                        max={300}
                        value={Math.round(config.duration_ms / 1000)}
                        onChange={e => {
                            const sec = Math.max(1, Math.min(300, Number(e.target.value) || 8));
                            setConfig(prev => ({...prev, duration_ms: sec * 1000}));
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                    />
                </div>
                <div>
                    <label
                        htmlFor="story-bg-select"
                        className="mb-1 block text-xs font-extrabold"
                        style={{color: 'var(--navy)'}}
                    >
                        Latar Panggung
                    </label>
                    <select
                        id="story-bg-select"
                        value={
                            config.background_asset_id
                                ? `asset:${config.background_asset_id}`
                                : `theme:${config.background_theme}`
                        }
                        onChange={e => {
                            const val = e.target.value;
                            if (val.startsWith('asset:')) {
                                setConfig(prev => ({
                                    ...prev,
                                    background_asset_id: val.slice('asset:'.length)
                                }));
                            } else {
                                setConfig(prev => ({
                                    ...prev,
                                    background_asset_id: null,
                                    background_theme: val.slice('theme:'.length) as StoryConfig['background_theme']
                                }));
                            }
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                    >
                        <option value="theme:forest">Tema Bawaan: Hutan Kode</option>
                        <option value="theme:meadow">Tema Bawaan: Padang Rumput</option>
                        <option value="theme:river">Tema Bawaan: Tepian Sungai</option>
                        <option value="theme:night">Tema Bawaan: Malam Bintang</option>
                        {imageAssets.map(img => (
                            <option key={img.id} value={`asset:${img.id}`}>
                                Gambar Pustaka: {img.nama}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Daftar Aktor / Gambar Bergerak */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-black" style={{color: 'var(--navy)'}}>
                        Karakter / Gambar Bergerak ({config.actors.length})
                    </h4>
                    <button
                        type="button"
                        onClick={addActor}
                        className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
                        style={{background: 'var(--navy)'}}
                    >
                        + Tambah Karakter
                    </button>
                </div>

                <div className="space-y-3">
                    {config.actors.map((actor, idx) => (
                        <div
                            key={actor.id}
                            className="grid items-end gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-5"
                        >
                            <div>
                                <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                    Nama Karakter
                                </label>
                                <input
                                    type="text"
                                    value={actor.name}
                                    onChange={e => updateActor(idx, {name: e.target.value})}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                    Gambar / Sprite
                                </label>
                                <select
                                    value={
                                        actor.asset_id
                                            ? `asset:${actor.asset_id}`
                                            : `sprite:${actor.sprite_url || BUILTIN_SPRITES[0].url}`
                                    }
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val.startsWith('asset:')) {
                                            updateActor(idx, {
                                                asset_id: val.slice('asset:'.length),
                                                sprite_url: undefined
                                            });
                                        } else {
                                            updateActor(idx, {
                                                asset_id: null,
                                                sprite_url: val.slice('sprite:'.length)
                                            });
                                        }
                                    }}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                >
                                    {BUILTIN_SPRITES.map(sp => (
                                        <option key={sp.url} value={`sprite:${sp.url}`}>
                                            Maskot: {sp.label}
                                        </option>
                                    ))}
                                    {imageAssets.map(img => (
                                        <option key={img.id} value={`asset:${img.id}`}>
                                            Pustaka: {img.nama}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                    <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                        Awal X (%)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={actor.initial_x}
                                        onChange={e =>
                                            updateActor(idx, {initial_x: Number(e.target.value)})
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                        Awal Y (%)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={actor.initial_y}
                                        onChange={e =>
                                            updateActor(idx, {initial_y: Number(e.target.value)})
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={actor.flip_x}
                                        onChange={e => updateActor(idx, {flip_x: e.target.checked})}
                                    />
                                    Balik
                                </label>
                                {config.actors.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeActor(actor.id)}
                                        className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                    >
                                        Hapus
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Timeline Track Editor */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h4 className="text-sm font-black" style={{color: 'var(--navy)'}}>
                            Timeline Cerita ({config.timeline.length} Event)
                        </h4>
                        <p className="text-xs font-semibold text-slate-500">
                            Atur kapan gambar bergerak, dialog muncul, dan suara diputar.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={addMoveEvent}
                            className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
                            style={{background: 'var(--teal)'}}
                        >
                            + Track Gerak
                        </button>
                        <button
                            type="button"
                            onClick={addDialogueEvent}
                            className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
                            style={{background: 'var(--navy)'}}
                        >
                            + Track Dialog
                        </button>
                        <button
                            type="button"
                            onClick={addAudioEvent}
                            className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-slate-900"
                            style={{background: 'var(--amber)'}}
                        >
                            + Track Suara
                        </button>
                    </div>
                </div>

                {/* Bar visual timeline */}
                {config.timeline.length > 0 && (
                    <div className="mb-4 space-y-1.5 rounded-xl bg-slate-900 p-3">
                        {config.timeline.map(ev => {
                            const leftPct = Math.min(
                                100,
                                Math.max(0, (ev.start_ms / config.duration_ms) * 100)
                            );
                            const widthPct = Math.min(
                                100 - leftPct,
                                Math.max(4, ((ev.end_ms - ev.start_ms) / config.duration_ms) * 100)
                            );
                            const color =
                                ev.kind === 'move'
                                    ? 'var(--teal)'
                                    : ev.kind === 'dialogue'
                                      ? 'var(--coral)'
                                      : 'var(--amber)';
                            return (
                                <div key={ev.id} className="relative h-5 rounded bg-white/10">
                                    <div
                                        className="absolute inset-y-0.5 truncate rounded px-2 text-[10px] leading-4 font-extrabold text-white"
                                        style={{
                                            left: `${leftPct}%`,
                                            width: `${widthPct}%`,
                                            background: color
                                        }}
                                    >
                                        {ev.kind.toUpperCase()} ({(ev.start_ms / 1000).toFixed(1)}–
                                        {(ev.end_ms / 1000).toFixed(1)}d)
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="space-y-3">
                    {config.timeline.map((ev, idx) => (
                        <div
                            key={ev.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <span
                                    className="rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase text-white"
                                    style={{
                                        background:
                                            ev.kind === 'move'
                                                ? 'var(--teal)'
                                                : ev.kind === 'dialogue'
                                                  ? 'var(--coral)'
                                                  : '#d4891a'
                                    }}
                                >
                                    {ev.kind === 'move'
                                        ? 'Gerak Aktor'
                                        : ev.kind === 'dialogue'
                                          ? 'Balon Dialog'
                                          : 'Track Suara'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeEvent(idx)}
                                    className="text-xs font-bold text-rose-600 hover:underline"
                                >
                                    Hapus Track
                                </button>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-4">
                                <div>
                                    <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                        Mulai (ms)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={config.duration_ms - 100}
                                        step={100}
                                        value={ev.start_ms}
                                        onChange={e =>
                                            updateEvent(idx, {start_ms: Number(e.target.value)})
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                        Selesai (ms)
                                    </label>
                                    <input
                                        type="number"
                                        min={ev.start_ms + 100}
                                        max={config.duration_ms}
                                        step={100}
                                        value={ev.end_ms}
                                        onChange={e =>
                                            updateEvent(idx, {end_ms: Number(e.target.value)})
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                    />
                                </div>

                                {ev.kind === 'move' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                Karakter
                                            </label>
                                            <select
                                                value={ev.actor_id}
                                                onChange={e =>
                                                    updateEvent(idx, {actor_id: e.target.value})
                                                }
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                            >
                                                {config.actors.map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div>
                                                <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                    Ke X (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={ev.to_x}
                                                    onChange={e =>
                                                        updateEvent(idx, {
                                                            to_x: Number(e.target.value)
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                    Ke Y (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={ev.to_y}
                                                    onChange={e =>
                                                        updateEvent(idx, {
                                                            to_y: Number(e.target.value)
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {ev.kind === 'dialogue' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                Pembicara
                                            </label>
                                            <input
                                                type="text"
                                                value={ev.speaker}
                                                onChange={e =>
                                                    updateEvent(idx, {speaker: e.target.value})
                                                }
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                Isi Dialog
                                            </label>
                                            <input
                                                type="text"
                                                value={ev.text}
                                                onChange={e =>
                                                    updateEvent(idx, {text: e.target.value})
                                                }
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                            />
                                        </div>
                                    </>
                                )}

                                {ev.kind === 'audio' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                Sumber Suara
                                            </label>
                                            <select
                                                value={ev.asset_id}
                                                onChange={e => {
                                                    const id = e.target.value;
                                                    const found =
                                                        audioAssets.find(a => a.id === id)?.nama ||
                                                        BUILTIN_SOUNDS.find(b => b.id === id)
                                                            ?.label ||
                                                        'Suara';
                                                    updateEvent(idx, {
                                                        asset_id: id,
                                                        label: found
                                                    });
                                                }}
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                            >
                                                {BUILTIN_SOUNDS.map(snd => (
                                                    <option key={snd.id} value={snd.id}>
                                                        {snd.label}
                                                    </option>
                                                ))}
                                                {audioAssets.map(aud => (
                                                    <option key={aud.id} value={aud.id}>
                                                        Pustaka: {aud.nama}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-extrabold text-slate-600">
                                                Volume (0.1 – 1.0)
                                            </label>
                                            <input
                                                type="number"
                                                min={0.1}
                                                max={1}
                                                step={0.1}
                                                value={ev.volume}
                                                onChange={e =>
                                                    updateEvent(idx, {
                                                        volume: Number(e.target.value)
                                                    })
                                                }
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
                    {saving ? 'Menyimpan…' : 'Simpan Stage Cerita & Timeline'}
                </button>
            </div>
        </div>
    );
}
