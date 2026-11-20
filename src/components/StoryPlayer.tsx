'use client';

import {useEffect, useRef, useState} from 'react';
import {
    computeStoryFrameAt,
    type StoryConfig
} from '@/lib/story/schema';

const THEME_GRADIENTS: Record<StoryConfig['background_theme'], string> = {
    forest: 'linear-gradient(180deg, #04a5ad 0%, #7ed957 68%, #2e7d32 100%)',
    meadow: 'linear-gradient(180deg, #6ec6ff 0%, #fff8f0 58%, #8bc34a 100%)',
    river: 'linear-gradient(180deg, #b2ebf2 0%, #04a5ad 55%, #025f65 100%)',
    night: 'linear-gradient(180deg, #111a38 0%, #1e2d5a 62%, #263670 100%)'
};

function playBuiltinTone(presetId: string, volume: number) {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    try {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = presetId === 'builtin:victory' ? 'triangle' : 'sine';
        osc.frequency.value =
            presetId === 'builtin:forest-chime'
                ? 523.25
                : presetId === 'builtin:victory'
                  ? 659.25
                  : 440;
        gain.gain.value = Math.max(0.05, Math.min(0.4, volume * 0.3));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.stop(ctx.currentTime + 0.45);
        window.setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch {
        // Abaikan bila autoplay audio diblokir browser sebelum interaksi pengguna.
    }
}

export function StoryPlayer({
    config,
    showControls = true,
    externalPlayback
}: {
    config: StoryConfig;
    showControls?: boolean;
    externalPlayback?: {
        status: 'idle' | 'playing' | 'paused';
        offset_ms: number;
        updated_at_ms: number;
    };
}) {
    const [playing, setPlaying] = useState(false);
    const [timeMs, setTimeMs] = useState(0);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const triggeredBuiltins = useRef<Set<string>>(new Set());

    // Sinkronkan dengan kontrol eksternal (Sesi Live) bila disediakan
    useEffect(() => {
        if (!externalPlayback) return;
        if (externalPlayback.status === 'idle') {
            setPlaying(false);
            setTimeMs(0);
            triggeredBuiltins.current.clear();
            return;
        }
        if (externalPlayback.status === 'paused') {
            setPlaying(false);
            setTimeMs(Math.min(config.duration_ms, Math.max(0, externalPlayback.offset_ms)));
            return;
        }
        if (externalPlayback.status === 'playing') {
            const elapsed = Math.max(0, Date.now() - externalPlayback.updated_at_ms);
            setTimeMs(
                Math.min(config.duration_ms, Math.max(0, externalPlayback.offset_ms + elapsed))
            );
            setPlaying(true);
        }
    }, [externalPlayback, config.duration_ms]);

    // Loop animasi berbasis requestAnimationFrame saat playing
    useEffect(() => {
        if (!playing) return;
        let last = performance.now();
        let rafId = 0;

        const tick = (now: number) => {
            const delta = now - last;
            last = now;
            setTimeMs(prev => {
                const next = prev + delta;
                if (next >= config.duration_ms) {
                    setPlaying(false);
                    return config.duration_ms;
                }
                return next;
            });
            rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
    }, [playing, config.duration_ms]);

    const frame = computeStoryFrameAt(config, timeMs);

    // Sinkronisasi pemutaran track suara
    useEffect(() => {
        const activeIds = new Set(frame.active_audios.map(a => a.id));

        for (const audioEv of frame.active_audios) {
            if (audioEv.asset_id.startsWith('builtin:')) {
                if (playing && !triggeredBuiltins.current.has(audioEv.id)) {
                    triggeredBuiltins.current.add(audioEv.id);
                    playBuiltinTone(audioEv.asset_id, audioEv.volume);
                }
                continue;
            }

            let el = audioRefs.current.get(audioEv.id);
            if (!el) {
                el = new Audio(`/api/v1/media/${audioEv.asset_id}`);
                audioRefs.current.set(audioEv.id, el);
            }
            el.volume = audioEv.volume;
            el.loop = audioEv.loop;
            if (playing && el.paused) {
                el.play().catch(() => {});
            } else if (!playing && !el.paused) {
                el.pause();
            }
        }

        for (const [id, el] of audioRefs.current.entries()) {
            if (!activeIds.has(id) && !el.paused) {
                el.pause();
                el.currentTime = 0;
            }
        }
    }, [frame.active_audios, playing]);

    useEffect(() => {
        const map = audioRefs.current;
        return () => {
            for (const el of map.values()) {
                el.pause();
            }
            map.clear();
        };
    }, []);

    function handleTogglePlay() {
        if (timeMs >= config.duration_ms) {
            triggeredBuiltins.current.clear();
            setTimeMs(0);
            setPlaying(true);
            return;
        }
        setPlaying(prev => !prev);
    }

    function handleRestart() {
        triggeredBuiltins.current.clear();
        for (const el of audioRefs.current.values()) {
            el.pause();
            el.currentTime = 0;
        }
        setTimeMs(0);
        setPlaying(false);
    }

    const bgStyle: React.CSSProperties = config.background_asset_id
        ? {
              backgroundImage: `url(/api/v1/media/${config.background_asset_id})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
          }
        : {
              background: THEME_GRADIENTS[config.background_theme] || THEME_GRADIENTS.forest
          };

    return (
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xs">
            {/* Panggung 16:9 */}
            <div className="relative aspect-video w-full overflow-hidden select-none" style={bgStyle}>
                {/* Dekorasi tema bawaan bila tidak memakai gambar latar kustom */}
                {!config.background_asset_id && (
                    <div className="pointer-events-none absolute inset-0">
                        <div
                            className="absolute right-10 top-6 h-14 w-14 rounded-full opacity-80"
                            style={{
                                background:
                                    config.background_theme === 'night' ? '#FFF2D6' : '#F5A623'
                            }}
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-black/15" />
                    </div>
                )}

                {/* Aktor bergerak */}
                {frame.actors.map(actor => {
                    const imgSrc = actor.asset_id
                        ? `/api/v1/media/${actor.asset_id}`
                        : actor.sprite_url || '/mascot/00-kelinci-penjelajah-utama.jpg';
                    return (
                        <div
                            key={actor.id}
                            className=" absolute transition-none"
                            style={{
                                left: `${actor.x}%`,
                                top: `${actor.y}%`,
                                opacity: actor.opacity,
                                transform: `translate(-50%, -50%) scale(${actor.scale}) scaleX(${
                                    actor.flip_x ? -1 : 1
                                })`
                            }}
                        >
                            <img
                                src={imgSrc}
                                alt={actor.name}
                                className="h-24 w-24 rounded-full border-4 border-[#1e2d5a] object-cover shadow-md sm:h-28 sm:w-28"
                            />
                        </div>
                    );
                })}

                {/* Indikator audio aktif */}
                {frame.active_audios.length > 0 && (
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-extrabold text-white">
                        <span>♪</span>
                        <span>
                            {frame.active_audios.map(a => a.label || 'Suara').join(', ')}
                        </span>
                    </div>
                )}

                {/* Balon Dialog */}
                {frame.dialogues.length > 0 && (
                    <div className="absolute inset-x-4 bottom-4 space-y-2">
                        {frame.dialogues.map(dlg => (
                            <div
                                key={dlg.id}
                                className="rounded-2xl border-2 border-[#1e2d5a] bg-white/95 px-4 py-3 shadow-lg"
                            >
                                <div
                                    className="text-xs font-black uppercase tracking-wide"
                                    style={{color: 'var(--teal-dark)'}}
                                >
                                    {dlg.speaker}
                                </div>
                                <div
                                    className="mt-0.5 text-sm font-bold sm:text-base"
                                    style={{color: 'var(--navy)'}}
                                >
                                    &ldquo;{dlg.text}&rdquo;
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Kontrol Pemutar & Timeline Bar */}
            {showControls && (
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="rounded-xl px-4 py-1.5 text-xs font-black text-white"
                        style={{background: 'var(--teal)'}}
                    >
                        {playing ? '⏸ Jeda' : timeMs >= config.duration_ms ? '↻ Putar Ulang' : '▶ Putar Cerita'}
                    </button>
                    <button
                        type="button"
                        onClick={handleRestart}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                    >
                        Reset (0.0d)
                    </button>

                    <div className="flex flex-1 items-center gap-2">
                        <label htmlFor="story-scrubber" className="sr-only">
                            Posisi waktu cerita
                        </label>
                        <input
                            id="story-scrubber"
                            type="range"
                            min={0}
                            max={config.duration_ms}
                            step={50}
                            value={Math.round(timeMs)}
                            onChange={e => {
                                setPlaying(false);
                                setTimeMs(Number(e.target.value));
                            }}
                            className="flex-1 accent-[#04a5ad]"
                        />
                        <span className="font-mono text-xs font-extrabold text-slate-600">
                            {(timeMs / 1000).toFixed(1)}d / {(config.duration_ms / 1000).toFixed(1)}d
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
