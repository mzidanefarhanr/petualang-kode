'use client';

import {useEffect, useRef, useState} from 'react';
import {
    countChallengeBlocks,
    evaluateChallenge,
    type ChallengeAction,
    type ChallengeBlockType,
    type ChallengeConfig,
    type ChallengeEvaluationResult,
    type Direction
} from '@/lib/challenge/engine';

const BLOCK_META: Record<
    ChallengeBlockType,
    {label: string; icon: string; color: string}
> = {
    move: {label: 'MAJU', icon: '→', color: '#04a5ad'},
    turn_left: {label: 'BELOK KIRI', icon: '↶', color: '#7c4dff'},
    turn_right: {label: 'BELOK KANAN', icon: '↷', color: '#7c4dff'},
    jump: {label: 'LOMPAT', icon: '⤴', color: '#e3235b'},
    collect: {label: 'AMBIL BINTANG', icon: '⭐', color: '#F5A623'},
    repeat: {label: 'ULANGI', icon: '↻', color: '#037d84'}
};

const DIR_ROTATION: Record<Direction, string> = {
    E: '0deg',
    S: '90deg',
    W: '180deg',
    N: '-90deg'
};

const DIR_ARROW: Record<Direction, string> = {
    E: '→',
    S: '↓',
    W: '←',
    N: '↑'
};

function playChallengeSound(
    cue: 'step' | 'collect' | 'win' | 'fail',
    customAssetId: string | null | undefined
) {
    if (typeof window === 'undefined') return;
    if (customAssetId) {
        const audio = new Audio(`/api/v1/media/${customAssetId}`);
        audio.volume = 0.85;
        audio.play().catch(() => {});
        return;
    }

    const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;

    try {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        if (cue === 'step') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(340, now);
            osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.09);
        } else if (cue === 'collect') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.09);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.24);
        } else if (cue === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.09);
                gain.gain.setValueAtTime(0.18, now + i * 0.09);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.09);
                osc.stop(now + i * 0.09 + 0.22);
            });
        } else if (cue === 'fail') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.28);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        }

        window.setTimeout(() => ctx.close().catch(() => {}), 700);
    } catch {
        // Abaikan jika audio diblokir browser.
    }
}

let blocklyBlocksRegistered = false;

export function ChallengePlayer({
    config,
    locked = false,
    onRunComplete
}: {
    config: ChallengeConfig;
    locked?: boolean;
    onRunComplete?: (payload: {
        actions: ChallengeAction[];
        result: ChallengeEvaluationResult;
    }) => void;
}) {
    const [actions, setActions] = useState<ChallengeAction[]>([]);
    const [running, setRunning] = useState(false);
    const [frameIndex, setFrameIndex] = useState(0);
    const [evalResult, setEvalResult] = useState<ChallengeEvaluationResult | null>(null);
    const [activeToolbarIdx, setActiveToolbarIdx] = useState(0);

    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const blocklyDivRef = useRef<HTMLDivElement | null>(null);
    const workspaceRef = useRef<any>(null);
    const blocklyModRef = useRef<any>(null);
    const syncingFromReactRef = useRef(false);

    const configSignature = JSON.stringify(config);

    // Reset hanya saat isi konfigurasi stage benar-benar berganti
    useEffect(() => {
        setRunning(false);
        setFrameIndex(0);
        setEvalResult(null);
    }, [configSignature]);

    const allowedBlocksSignature = config.allowed_blocks.join(',');

    // Inisialisasi Blockly workspace secara dinamis di klien
    useEffect(() => {
        let disposed = false;

        async function initBlockly() {
            if (!blocklyDivRef.current) return;
            try {
                const Blockly = await import('blockly');
                if (disposed || !blocklyDivRef.current) return;
                blocklyModRef.current = Blockly;

                if (!blocklyBlocksRegistered) {
                    Blockly.common.defineBlocksWithJsonArray([
                        {
                            type: 'pk_move',
                            message0: '→ MAJU %1 langkah',
                            args0: [{type: 'field_number', name: 'STEPS', value: 1, min: 1, max: 10}],
                            previousStatement: null,
                            nextStatement: null,
                            colour: '#04a5ad'
                        },
                        {
                            type: 'pk_turn_left',
                            message0: '↶ BELOK KIRI',
                            previousStatement: null,
                            nextStatement: null,
                            colour: '#7c4dff'
                        },
                        {
                            type: 'pk_turn_right',
                            message0: '↷ BELOK KANAN',
                            previousStatement: null,
                            nextStatement: null,
                            colour: '#7c4dff'
                        },
                        {
                            type: 'pk_jump',
                            message0: '⤴ LOMPAT',
                            previousStatement: null,
                            nextStatement: null,
                            colour: '#e3235b'
                        },
                        {
                            type: 'pk_collect',
                            message0: '⭐ AMBIL BINTANG',
                            previousStatement: null,
                            nextStatement: null,
                            colour: '#F5A623'
                        },
                        {
                            type: 'pk_repeat',
                            message0: '↻ ULANGI %1 kali %2 %3',
                            args0: [
                                {type: 'field_number', name: 'COUNT', value: 3, min: 2, max: 15},
                                {type: 'input_dummy'},
                                {type: 'input_statement', name: 'DO'}
                            ],
                            previousStatement: null,
                            nextStatement: null,
                            colour: '#037d84'
                        }
                    ]);
                    blocklyBlocksRegistered = true;
                }

                const toolboxContents = config.allowed_blocks.map(b => ({
                    kind: 'block',
                    type: `pk_${b}`
                }));

                if (workspaceRef.current) {
                    workspaceRef.current.dispose();
                }

                const ws = Blockly.inject(blocklyDivRef.current, {
                    toolbox: {kind: 'flyoutToolbox', contents: toolboxContents},
                    trashcan: true,
                    scrollbars: true,
                    sounds: false
                });
                workspaceRef.current = ws;

                const parseBlockChain = (firstBlock: any): ChallengeAction[] => {
                    const list: ChallengeAction[] = [];
                    let cur = firstBlock;
                    while (cur) {
                        if (cur.type === 'pk_move') {
                            list.push({
                                type: 'move',
                                steps: Math.max(1, Math.min(10, Number(cur.getFieldValue('STEPS')) || 1))
                            });
                        } else if (cur.type === 'pk_turn_left') {
                            list.push({type: 'turn_left'});
                        } else if (cur.type === 'pk_turn_right') {
                            list.push({type: 'turn_right'});
                        } else if (cur.type === 'pk_jump') {
                            list.push({type: 'jump'});
                        } else if (cur.type === 'pk_collect') {
                            list.push({type: 'collect'});
                        } else if (cur.type === 'pk_repeat') {
                            const count = Math.max(
                                2,
                                Math.min(15, Number(cur.getFieldValue('COUNT')) || 3)
                            );
                            const child = cur.getInputTargetBlock('DO');
                            list.push({
                                type: 'repeat',
                                count,
                                body: parseBlockChain(child)
                            });
                        }
                        cur = cur.getNextBlock();
                    }
                    return list;
                };

                ws.addChangeListener(() => {
                    if (syncingFromReactRef.current) return;
                    const topBlocks = ws.getTopBlocks(true);
                    if (topBlocks.length === 0) {
                        setActions([]);
                        return;
                    }
                    const parsed: ChallengeAction[] = [];
                    for (const b of topBlocks) {
                        parsed.push(...parseBlockChain(b));
                    }
                    setActions(parsed);
                });
            } catch {
                // Fallback ke daftar blok interaktif bila kanvas SVG Blockly tidak dimuat
            }
        }

        initBlockly();

        return () => {
            disposed = true;
            if (workspaceRef.current) {
                try {
                    workspaceRef.current.dispose();
                } catch {}
                workspaceRef.current = null;
            }
        };
    }, [allowedBlocksSignature]);

    // Sinkronkan perubahan dari tombol cepat ke Blockly workspace
    function syncActionsToBlockly(nextActions: ChallengeAction[]) {
        const ws = workspaceRef.current;
        if (!ws) return;
        syncingFromReactRef.current = true;
        try {
            ws.clear();
            const buildChain = (items: ChallengeAction[]): any => {
                let first: any = null;
                let prev: any = null;
                for (const item of items) {
                    const blk = ws.newBlock(`pk_${item.type}`);
                    if (item.type === 'move') {
                        blk.setFieldValue(String(item.steps ?? 1), 'STEPS');
                    } else if (item.type === 'repeat') {
                        blk.setFieldValue(String(item.count ?? 3), 'COUNT');
                        const innerFirst = buildChain(item.body || []);
                        if (innerFirst && blk.getInput('DO')?.connection && innerFirst.previousConnection) {
                            blk.getInput('DO').connection.connect(innerFirst.previousConnection);
                        }
                    }
                    blk.initSvg();
                    blk.render();
                    if (!first) {
                        first = blk;
                    }
                    if (prev && prev.nextConnection && blk.previousConnection) {
                        prev.nextConnection.connect(blk.previousConnection);
                    }
                    prev = blk;
                }
                return first;
            };
            const top = buildChain(nextActions);
            if (top) {
                top.moveBy(20, 20);
            }
        } catch {
            // Abaikan error render SVG di lingkungan headless
        } finally {
            syncingFromReactRef.current = false;
        }
    }

    function appendBlock(type: ChallengeBlockType) {
        if (locked || running) return;
        const newAct: ChallengeAction =
            type === 'move'
                ? {type: 'move', steps: 1}
                : type === 'repeat'
                  ? {type: 'repeat', count: 3, body: [{type: 'move', steps: 1}]}
                  : ({type} as ChallengeAction);

        const next = [...actions, newAct];
        setActions(next);
        syncActionsToBlockly(next);
    }

    function updateActionAt(index: number, patch: Partial<ChallengeAction>) {
        if (locked || running) return;
        const next = actions.map((a, i) => (i === index ? ({...a, ...patch} as ChallengeAction) : a));
        setActions(next);
        syncActionsToBlockly(next);
    }

    function removeActionAt(index: number) {
        if (locked || running) return;
        const next = actions.filter((_, i) => i !== index);
        setActions(next);
        syncActionsToBlockly(next);
    }

    function handleClearWorkspace() {
        if (locked || running) return;
        setActions([]);
        setEvalResult(null);
        setFrameIndex(0);
        syncActionsToBlockly([]);
    }

    function handleResetPosition() {
        setRunning(false);
        setFrameIndex(0);
        setEvalResult(null);
    }

    function handleRunProgram() {
        if (locked || running) return;
        const result = evaluateChallenge(config, actions);
        setEvalResult(result);
        setFrameIndex(0);

        if (result.trace.length <= 1) {
            playChallengeSound('fail', config.sounds.fail);
            onRunCompleteRef.current?.({actions, result});
            return;
        }

        setRunning(true);
    }

    const soundsSignature = JSON.stringify(config.sounds);
    const onRunCompleteRef = useRef(onRunComplete);
    onRunCompleteRef.current = onRunComplete;

    // Animasi langkah demi langkah
    useEffect(() => {
        if (!running || !evalResult) return;

        if (frameIndex >= evalResult.trace.length - 1) {
            setRunning(false);
            const finalFrame = evalResult.trace[evalResult.trace.length - 1];
            if (evalResult.completed) {
                playChallengeSound('win', config.sounds.win);
            } else if (finalFrame?.sound_cue !== 'fail') {
                playChallengeSound('fail', config.sounds.fail);
            }
            onRunCompleteRef.current?.({actions, result: evalResult});
            return;
        }

        const timer = window.setTimeout(() => {
            const nextIdx = frameIndex + 1;
            const frame = evalResult.trace[nextIdx];
            setFrameIndex(nextIdx);
            if (frame) {
                if (frame.sound_cue === 'collect') {
                    playChallengeSound('collect', config.sounds.collect);
                } else if (frame.sound_cue === 'fail') {
                    playChallengeSound('fail', config.sounds.fail);
                } else if (frame.sound_cue === 'step') {
                    playChallengeSound('step', config.sounds.step);
                }
            }
        }, 360);

        return () => window.clearTimeout(timer);
    }, [running, frameIndex, evalResult, soundsSignature, actions]);

    // Roving tabindex fallback bila native focusgroup belum didukung browser
    function handleToolbarKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if ('focusGroup' in HTMLElement.prototype) return;
        const count = config.allowed_blocks.length;
        if (count === 0) return;

        let nextIdx = activeToolbarIdx;
        if (event.key === 'ArrowRight') {
            nextIdx = (activeToolbarIdx + 1) % count;
        } else if (event.key === 'ArrowLeft') {
            nextIdx = (activeToolbarIdx - 1 + count) % count;
        } else if (event.key === 'Home') {
            nextIdx = 0;
        } else if (event.key === 'End') {
            nextIdx = count - 1;
        } else {
            return;
        }
        event.preventDefault();
        setActiveToolbarIdx(nextIdx);
        const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>('button[data-toolbar-item]');
        buttons?.[nextIdx]?.focus();
    }

    const currentFrame = evalResult?.trace[frameIndex] ?? {
        step: 0,
        x: config.start.x,
        y: config.start.y,
        dir: config.start.dir,
        action: 'init' as const,
        collected_stars: [] as string[],
        sound_cue: 'none' as const
    };

    const wallSet = new Set(config.walls.map(p => `${p.x},${p.y}`));
    const hazardSet = new Set(config.hazards.map(p => `${p.x},${p.y}`));
    const starSet = new Set(config.stars.map(p => `${p.x},${p.y}`));
    const collectedSet = new Set(currentFrame.collected_stars);
    const totalBlocksUsed = countChallengeBlocks(actions);
    const charImg = config.character_asset_id
        ? `/api/v1/media/${config.character_asset_id}`
        : '/mascot/pose-ui/08-ikon-kepala-avatar.jpg';

    return (
        <div className="space-y-4">
            {/* Banner Misi */}
            <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3"
                style={{
                    background: 'rgba(4, 165, 173, 0.08)',
                    borderColor: 'rgba(4, 165, 173, 0.25)'
                }}
            >
                <div className="flex items-center gap-3">
                    <img
                        src={charImg}
                        alt="Kelinci Penjelajah"
                        className="h-10 w-10 rounded-full border-2 border-[#1e2d5a] object-cover"
                    />
                    <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#037d84]">
                            Misi Tantangan Blok
                        </div>
                        <p className="text-sm font-black" style={{color: 'var(--navy)'}}>
                            {config.instruction}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-extrabold">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-2xs">
                        Blok dipakai: <strong>{totalBlocksUsed}</strong> (Target ideal:{' '}
                        {config.ideal_blocks})
                    </span>
                </div>
            </div>

            <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr]">
                {/* Overlay Kunci Interaksi saat Admin menjelaskan */}
                {locked && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-slate-900/75 p-6 text-center text-white backdrop-blur-xs">
                        <img
                            src="/mascot/pose-ui/07-pose-menyapa-onboarding.jpg"
                            alt="Perhatikan penjelasan guru"
                            className="h-28 w-28 rounded-full border-4 border-[#F5A623] object-cover"
                        />
                        <h3 className="mt-3 text-xl font-black">
                            Perhatikan Penjelasan Gurumu Dulu Ya!
                        </h3>
                        <p className="mt-1 max-w-sm text-sm font-semibold text-white/85">
                            Papan blok akan terbuka otomatis begitu gurumu membuka tantangan ini.
                        </p>
                    </div>
                )}

                {/* SISI KIRI: WORKSPACE BLOK (Blockly + Toolbar Blok Cepat) */}
                <div className="flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                            1. Tambah &amp; Susun Blok Perintah
                        </span>
                        <button
                            type="button"
                            disabled={locked || running || actions.length === 0}
                            onClick={handleClearWorkspace}
                            className="text-xs font-extrabold text-rose-600 hover:underline disabled:opacity-40"
                        >
                            Kosongkan Blok
                        </button>
                    </div>

                    {/* Toolbar Palet Blok (sesuai panduan modern-web-guidance `toolbar`) */}
                    <div
                        ref={toolbarRef}
                        role="toolbar"
                        aria-label="Palet blok perintah"
                        {...({focusgroup: 'toolbar wrap'} as any)}
                        onKeyDown={handleToolbarKeyDown}
                        className="mb-3 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-2"
                    >
                        <div role="group" aria-label="Tambah blok perintah" className="flex flex-wrap gap-1.5">
                            {config.allowed_blocks.map((b, idx) => {
                                const meta = BLOCK_META[b];
                                return (
                                    <button
                                        key={b}
                                        type="button"
                                        data-toolbar-item
                                        tabIndex={idx === activeToolbarIdx ? 0 : -1}
                                        onFocus={() => setActiveToolbarIdx(idx)}
                                        aria-disabled={locked || running ? 'true' : 'false'}
                                        onClick={() => {
                                            if (locked || running) return;
                                            appendBlock(b);
                                        }}
                                        className="rounded-lg px-3 py-1.5 text-xs font-black text-white shadow-2xs transition hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e2d5a]"
                                        style={{background: meta.color, minHeight: 34}}
                                    >
                                        + {meta.icon} {meta.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Kanvas Blockly Visual */}
                    <div
                        ref={blocklyDivRef}
                        className="h-56 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                        aria-label="Area kerja blok visual Blockly"
                    />

                    {/* Daftar Susunan Blok Terstruktur (Sinkron dengan Blockly & mudah diedit) */}
                    <div className="mt-3 flex-1 rounded-xl border border-slate-200 bg-slate-900 p-3 text-white">
                        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-white/50">
                            Urutan Program Saat Ini ({actions.length} baris utama)
                        </div>
                        {actions.length === 0 ? (
                            <p className="py-4 text-center text-xs font-semibold text-white/50">
                                Belum ada blok. Klik tombol <strong>+ Blok</strong> di atas atau
                                tarik blok di kanvas Blockly.
                            </p>
                        ) : (
                            <ol className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                                {actions.map((act, idx) => {
                                    const meta = BLOCK_META[act.type];
                                    return (
                                        <li
                                            key={idx}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-extrabold text-white"
                                            style={{background: meta.color}}
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span>
                                                    {idx + 1}. {meta.icon} {meta.label}
                                                </span>
                                                {act.type === 'move' && (
                                                    <label className="inline-flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={10}
                                                            aria-label={`Jumlah langkah maju baris ${idx + 1}`}
                                                            value={act.steps ?? 1}
                                                            onChange={e =>
                                                                updateActionAt(idx, {
                                                                    steps: Math.max(
                                                                        1,
                                                                        Math.min(
                                                                            10,
                                                                            Number(e.target.value) || 1
                                                                        )
                                                                    )
                                                                })
                                                            }
                                                            className="w-12 rounded bg-white/95 px-1.5 py-0.5 text-center text-xs font-black text-slate-900"
                                                        />
                                                        <span>langkah</span>
                                                    </label>
                                                )}
                                                {act.type === 'repeat' && (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min={2}
                                                            max={15}
                                                            aria-label={`Jumlah pengulangan baris ${idx + 1}`}
                                                            value={act.count}
                                                            onChange={e =>
                                                                updateActionAt(idx, {
                                                                    count: Math.max(
                                                                        2,
                                                                        Math.min(
                                                                            15,
                                                                            Number(e.target.value) || 2
                                                                        )
                                                                    )
                                                                })
                                                            }
                                                            className="w-12 rounded bg-white/95 px-1.5 py-0.5 text-center text-xs font-black text-slate-900"
                                                        />
                                                        <span>kali:</span>
                                                        <select
                                                            aria-label={`Aksi di dalam ulangi baris ${idx + 1}`}
                                                            value={act.body[0]?.type || 'move'}
                                                            onChange={e => {
                                                                const innerType = e.target
                                                                    .value as ChallengeBlockType;
                                                                const innerAct: ChallengeAction =
                                                                    innerType === 'move'
                                                                        ? {type: 'move', steps: 1}
                                                                        : ({
                                                                              type: innerType
                                                                          } as ChallengeAction);
                                                                updateActionAt(idx, {
                                                                    body: [innerAct]
                                                                });
                                                            }}
                                                            className="rounded bg-white/95 px-2 py-0.5 text-xs font-black text-slate-900"
                                                        >
                                                            {config.allowed_blocks
                                                                .filter(b => b !== 'repeat')
                                                                .map(b => (
                                                                    <option key={b} value={b}>
                                                                        {BLOCK_META[b].label}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeActionAt(idx)}
                                                aria-label={`Hapus blok baris ${idx + 1}`}
                                                className="rounded bg-black/25 px-2 py-0.5 text-xs font-black text-white hover:bg-black/40"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>

                    {/* Tombol Jalankan & Reset */}
                    <div className="mt-4 flex gap-2.5">
                        <button
                            type="button"
                            disabled={locked || running}
                            onClick={handleRunProgram}
                            className="flex-1 rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm transition hover:opacity-95"
                            style={{
                                background: '#2e7d32',
                                boxShadow: '0 4px 0 #1b5e20'
                            }}
                        >
                            {running ? 'Menjalankan…' : '▶ Jalankan Kode'}
                        </button>
                        <button
                            type="button"
                            onClick={handleResetPosition}
                            className="rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                            ↺ Reset Peta
                        </button>
                    </div>
                </div>

                {/* SISI KANAN: PANGGUNG PETA 2D CODEMONKEY */}
                <div className="flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-4">
                    <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                                2. Panggung Peta 2D ({config.cols}×{config.rows})
                            </span>
                            <div className="flex items-center gap-3 text-xs font-extrabold text-slate-600">
                                <span>
                                    ⭐ Bintang: {collectedSet.size}/{starSet.size}
                                </span>
                                <span>
                                    Arah: {DIR_ARROW[currentFrame.dir]} ({currentFrame.dir})
                                </span>
                            </div>
                        </div>

                        {/* Grid Peta */}
                        <div
                            className="mx-auto grid gap-1.5 rounded-2xl border-4 border-[#1e2d5a] bg-[#c8e6c9] p-2.5 shadow-inner"
                            style={{
                                gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
                                maxWidth: 460
                            }}
                        >
                            {Array.from({length: config.rows}).map((_, ry) =>
                                Array.from({length: config.cols}).map((__, cx) => {
                                    const key = `${cx},${ry}`;
                                    const isChar =
                                        currentFrame.x === cx && currentFrame.y === ry;
                                    const isGoal =
                                        config.goal.x === cx && config.goal.y === ry;
                                    const isWall = wallSet.has(key);
                                    const isHazard = hazardSet.has(key);
                                    const hasStar = starSet.has(key) && !collectedSet.has(key);

                                    let tileBg = 'bg-[#e8f5e9] border-[#a5d6a7]';
                                    if (isWall) tileBg = 'bg-[#5d4037] border-[#3e2723] text-white';
                                    else if (isHazard)
                                        tileBg = 'bg-[#29b6f6] border-[#0288d1] text-white';
                                    else if (isGoal)
                                        tileBg = 'bg-[#fff3e0] border-[#F5A623]';

                                    return (
                                        <div
                                            key={key}
                                            data-tile={key}
                                            className={`relative flex aspect-square items-center justify-center rounded-xl border-2 text-lg select-none sm:text-2xl ${tileBg}`}
                                        >
                                            {isWall && <span title="Rintangan">🪨</span>}
                                            {isHazard && <span title="Sungai">🌊</span>}
                                            {hasStar && (
                                                <span
                                                    className="animate-bounce"
                                                    title="Bintang"
                                                >
                                                    ⭐
                                                </span>
                                            )}
                                            {isGoal && (
                                                <span title="Bendera Tujuan">🏁</span>
                                            )}
                                            {isChar && (
                                                <div
                                                    className="absolute inset-1 z-10 flex items-center justify-center rounded-full border-2 border-[#1e2d5a] bg-[#04a5ad] shadow-md transition-transform duration-300"
                                                    title={`Kelinci menghadap ${currentFrame.dir}`}
                                                >
                                                    <span className="text-base sm:text-xl">
                                                        🐰
                                                    </span>
                                                    <span
                                                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F5A623] text-[10px] font-black text-slate-900"
                                                        style={{
                                                            transform: `rotate(${DIR_ROTATION[currentFrame.dir]})`
                                                        }}
                                                    >
                                                        →
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Panel Hasil Evaluasi + Maskot Pose UI */}
                    {evalResult && !running && (
                        <div
                            role="status"
                            aria-live="polite"
                            className={`mt-4 flex items-center gap-4 rounded-2xl border-2 p-4 ${
                                evalResult.completed
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                                    : 'border-amber-300 bg-amber-50 text-amber-950'
                            }`}
                        >
                            <img
                                src={
                                    evalResult.completed
                                        ? '/mascot/pose-ui/06-pose-selebrasi-menang.jpg'
                                        : '/mascot/pose-ui/05-pose-berpikir-debugging.jpg'
                                }
                                alt={
                                    evalResult.completed
                                        ? 'Kelinci Penjelajah selebrasi menang'
                                        : 'Kelinci Penjelajah berpikir'
                                }
                                className="h-16 w-16 shrink-0 rounded-full border-3 border-[#1e2d5a] object-cover"
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black">
                                        {evalResult.completed
                                            ? 'Misi Berhasil Diselesaikan!'
                                            : 'Ayo Periksa Lagi Blokmu!'}
                                    </h4>
                                    {evalResult.completed && (
                                        <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-slate-900">
                                            {'⭐'.repeat(evalResult.stars_earned)}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs font-bold leading-relaxed">
                                    {evalResult.message}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
