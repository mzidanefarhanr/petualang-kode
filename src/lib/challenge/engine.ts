import {MAX_CHALLENGE_STEPS, MAX_GRID_COLS, MAX_GRID_ROWS} from '@/lib/config';
import {ApiError} from '@/lib/http/errors';

export type Direction = 'N' | 'E' | 'S' | 'W';

export type ChallengeBlockType =
    | 'move'
    | 'turn_left'
    | 'turn_right'
    | 'jump'
    | 'collect'
    | 'repeat';

export interface GridPoint {
    x: number;
    y: number;
}

export interface ChallengeConfig {
    instruction: string;
    cols: number;
    rows: number;
    start: {x: number; y: number; dir: Direction};
    goal: GridPoint;
    walls: GridPoint[];
    hazards: GridPoint[];
    stars: GridPoint[];
    allowed_blocks: ChallengeBlockType[];
    ideal_blocks: number;
    character_asset_id: string | null;
    sounds: {
        step: string | null;
        collect: string | null;
        win: string | null;
        fail: string | null;
    };
}

export type ChallengeAction =
    | {type: 'move'; steps?: number}
    | {type: 'turn_left'}
    | {type: 'turn_right'}
    | {type: 'jump'}
    | {type: 'collect'}
    | {type: 'repeat'; count: number; body: ChallengeAction[]};

export interface ChallengeStepFrame {
    step: number;
    x: number;
    y: number;
    dir: Direction;
    action: ChallengeBlockType | 'init';
    collected_stars: string[];
    sound_cue: 'none' | 'step' | 'collect' | 'win' | 'fail';
    note?: string;
}

export interface ChallengeEvaluationResult {
    completed: boolean;
    reason_code:
        | 'BERHASIL'
        | 'TABRAK_RINTANGAN'
        | 'KENA_BAHAYA'
        | 'LANGKAH_TERLALU_BANYAK'
        | 'BINTANG_BELUM_LENGKAP'
        | 'BELUM_SAMPAI_TUJUAN'
        | 'BLOK_TIDAK_DIIZINKAN'
        | 'PROGRAM_KOSONG';
    message: string;
    blocks_used: number;
    steps_taken: number;
    stars_collected: number;
    stars_total: number;
    stars_earned: 0 | 1 | 2 | 3;
    trace: ChallengeStepFrame[];
}

const ALL_BLOCK_TYPES: ChallengeBlockType[] = [
    'move',
    'turn_left',
    'turn_right',
    'jump',
    'collect',
    'repeat'
];

const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

function pointKey(p: GridPoint): string {
    return `${p.x},${p.y}`;
}

export function defaultChallengeConfig(): ChallengeConfig {
    return {
        instruction:
            'Susun blok perintah agar Kelinci Penjelajah mengambil bintang dan sampai ke bendera tujuan!',
        cols: 5,
        rows: 5,
        start: {x: 0, y: 2, dir: 'E'},
        goal: {x: 4, y: 2},
        walls: [
            {x: 2, y: 1},
            {x: 2, y: 3}
        ],
        hazards: [{x: 2, y: 2}],
        stars: [{x: 1, y: 2}],
        allowed_blocks: ['move', 'turn_left', 'turn_right', 'jump', 'collect', 'repeat'],
        ideal_blocks: 4,
        character_asset_id: null,
        sounds: {
            step: null,
            collect: null,
            win: null,
            fail: null
        }
    };
}

function normalizePoints(raw: unknown, cols: number, rows: number): GridPoint[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: GridPoint[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const p = item as Record<string, unknown>;
        const x = Math.floor(Number(p.x));
        const y = Math.floor(Number(p.y));
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= cols || y < 0 || y >= rows) {
            continue;
        }
        const key = `${x},${y}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({x, y});
        }
    }
    return out;
}

export function validateChallengeConfig(raw: unknown): ChallengeConfig {
    if (!raw || typeof raw !== 'object') {
        throw new ApiError(400, 'CHALLENGE_CONFIG_TIDAK_VALID', 'Konfigurasi challenge tidak valid.');
    }
    const obj = raw as Record<string, unknown>;
    if (Object.keys(obj).length === 0) {
        return defaultChallengeConfig();
    }

    const cols = Math.floor(Number(obj.cols ?? 5));
    const rows = Math.floor(Number(obj.rows ?? 5));
    if (
        !Number.isFinite(cols) ||
        !Number.isFinite(rows) ||
        cols < 3 ||
        cols > MAX_GRID_COLS ||
        rows < 3 ||
        rows > MAX_GRID_ROWS
    ) {
        throw new ApiError(
            400,
            'UKURAN_PETA_TIDAK_VALID',
            `Ukuran peta harus antara 3x3 hingga ${MAX_GRID_COLS}x${MAX_GRID_ROWS}.`
        );
    }

    const startObj = (obj.start && typeof obj.start === 'object' ? obj.start : {}) as Record<
        string,
        unknown
    >;
    const startX = Math.floor(Number(startObj.x ?? 0));
    const startY = Math.floor(Number(startObj.y ?? 0));
    const startDir: Direction = DIRECTIONS.includes(startObj.dir as Direction)
        ? (startObj.dir as Direction)
        : 'E';

    const goalObj = (obj.goal && typeof obj.goal === 'object' ? obj.goal : {}) as Record<
        string,
        unknown
    >;
    const goalX = Math.floor(Number(goalObj.x ?? cols - 1));
    const goalY = Math.floor(Number(goalObj.y ?? rows - 1));

    if (
        startX < 0 ||
        startX >= cols ||
        startY < 0 ||
        startY >= rows ||
        goalX < 0 ||
        goalX >= cols ||
        goalY < 0 ||
        goalY >= rows
    ) {
        throw new ApiError(
            400,
            'POSISI_PETA_TIDAK_VALID',
            'Posisi awal karakter dan bendera tujuan harus berada di dalam batas peta.'
        );
    }

    if (startX === goalX && startY === goalY) {
        throw new ApiError(
            400,
            'START_SAMA_DENGAN_GOAL',
            'Posisi awal karakter tidak boleh berada di petak yang sama dengan tujuan.'
        );
    }

    const startKey = `${startX},${startY}`;
    const goalKey = `${goalX},${goalY}`;

    const walls = normalizePoints(obj.walls, cols, rows).filter(
        p => pointKey(p) !== startKey && pointKey(p) !== goalKey
    );
    const wallSet = new Set(walls.map(pointKey));

    const hazards = normalizePoints(obj.hazards, cols, rows).filter(
        p => pointKey(p) !== startKey && pointKey(p) !== goalKey && !wallSet.has(pointKey(p))
    );
    const hazardSet = new Set(hazards.map(pointKey));

    const stars = normalizePoints(obj.stars, cols, rows).filter(
        p => !wallSet.has(pointKey(p)) && !hazardSet.has(pointKey(p))
    );

    const rawAllowed = Array.isArray(obj.allowed_blocks) ? obj.allowed_blocks : ALL_BLOCK_TYPES;
    const allowed_blocks = rawAllowed.filter((b): b is ChallengeBlockType =>
        ALL_BLOCK_TYPES.includes(b as ChallengeBlockType)
    );
    if (allowed_blocks.length === 0) {
        throw new ApiError(
            400,
            'BLOK_CHALLENGE_KOSONG',
            'Pilih minimal 1 jenis blok yang diizinkan untuk stage ini.'
        );
    }

    const instruction =
        typeof obj.instruction === 'string' && obj.instruction.trim().length > 0
            ? obj.instruction.trim().slice(0, 300)
            : defaultChallengeConfig().instruction;

    const ideal_blocks = Math.max(1, Math.min(50, Math.floor(Number(obj.ideal_blocks ?? 4)) || 4));

    const character_asset_id =
        typeof obj.character_asset_id === 'string' && obj.character_asset_id.trim().length > 0
            ? obj.character_asset_id.trim()
            : null;

    const rawSounds = (obj.sounds && typeof obj.sounds === 'object' ? obj.sounds : {}) as Record<
        string,
        unknown
    >;
    const cleanSound = (v: unknown) =>
        typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

    return {
        instruction,
        cols,
        rows,
        start: {x: startX, y: startY, dir: startDir},
        goal: {x: goalX, y: goalY},
        walls,
        hazards,
        stars,
        allowed_blocks,
        ideal_blocks,
        character_asset_id,
        sounds: {
            step: cleanSound(rawSounds.step),
            collect: cleanSound(rawSounds.collect),
            win: cleanSound(rawSounds.win),
            fail: cleanSound(rawSounds.fail)
        }
    };
}

export function countChallengeBlocks(actions: ChallengeAction[]): number {
    let total = 0;
    for (const act of actions) {
        total += 1;
        if (act.type === 'repeat' && Array.isArray(act.body)) {
            total += countChallengeBlocks(act.body);
        }
    }
    return total;
}

function findDisallowedBlock(
    actions: ChallengeAction[],
    allowed: Set<ChallengeBlockType>
): ChallengeBlockType | null {
    for (const act of actions) {
        if (!act || typeof act !== 'object' || !allowed.has(act.type)) {
            return (act?.type as ChallengeBlockType) || 'move';
        }
        if (act.type === 'repeat' && Array.isArray(act.body)) {
            const inner = findDisallowedBlock(act.body, allowed);
            if (inner) return inner;
        }
    }
    return null;
}

function turnLeft(dir: Direction): Direction {
    const idx = DIRECTIONS.indexOf(dir);
    return DIRECTIONS[(idx + 3) % 4];
}

function turnRight(dir: Direction): Direction {
    const idx = DIRECTIONS.indexOf(dir);
    return DIRECTIONS[(idx + 1) % 4];
}

function deltaForDir(dir: Direction): {dx: number; dy: number} {
    switch (dir) {
        case 'N':
            return {dx: 0, dy: -1};
        case 'E':
            return {dx: 1, dy: 0};
        case 'S':
            return {dx: 0, dy: 1};
        case 'W':
            return {dx: -1, dy: 0};
    }
}

export function evaluateChallenge(
    config: ChallengeConfig,
    actions: ChallengeAction[]
): ChallengeEvaluationResult {
    const wallSet = new Set(config.walls.map(pointKey));
    const hazardSet = new Set(config.hazards.map(pointKey));
    const starSet = new Set(config.stars.map(pointKey));
    const allowedSet = new Set(config.allowed_blocks);
    const autoCollectOnStep = !allowedSet.has('collect');

    const collected = new Set<string>();
    let x = config.start.x;
    let y = config.start.y;
    let dir: Direction = config.start.dir;

    if (autoCollectOnStep && starSet.has(`${x},${y}`)) {
        collected.add(`${x},${y}`);
    }

    const trace: ChallengeStepFrame[] = [
        {
            step: 0,
            x,
            y,
            dir,
            action: 'init',
            collected_stars: Array.from(collected),
            sound_cue: 'none'
        }
    ];

    if (!Array.isArray(actions) || actions.length === 0) {
        return {
            completed: false,
            reason_code: 'PROGRAM_KOSONG',
            message: 'Susun minimal satu blok perintah terlebih dahulu sebelum menekan Jalankan ya!',
            blocks_used: 0,
            steps_taken: 0,
            stars_collected: collected.size,
            stars_total: starSet.size,
            stars_earned: 0,
            trace
        };
    }

    const blocks_used = countChallengeBlocks(actions);
    const disallowed = findDisallowedBlock(actions, allowedSet);
    if (disallowed) {
        return {
            completed: false,
            reason_code: 'BLOK_TIDAK_DIIZINKAN',
            message: `Blok "${disallowed}" tidak diizinkan pada tantangan ini.`,
            blocks_used,
            steps_taken: 0,
            stars_collected: collected.size,
            stars_total: starSet.size,
            stars_earned: 0,
            trace
        };
    }

    let stepCounter = 0;
    let failure: {
        code: 'TABRAK_RINTANGAN' | 'KENA_BAHAYA' | 'LANGKAH_TERLALU_BANYAK';
        message: string;
    } | null = null;

    function checkOutOfBoundsOrWall(nx: number, ny: number): boolean {
        return nx < 0 || nx >= config.cols || ny < 0 || ny >= config.rows || wallSet.has(`${nx},${ny}`);
    }

    function runSequence(seq: ChallengeAction[], depth: number): void {
        if (failure || depth > 8) return;

        for (const act of seq) {
            if (failure) return;

            if (act.type === 'move') {
                const count = Math.max(1, Math.min(10, Math.floor(Number(act.steps ?? 1)) || 1));
                for (let s = 0; s < count; s++) {
                    stepCounter += 1;
                    if (stepCounter > MAX_CHALLENGE_STEPS) {
                        failure = {
                            code: 'LANGKAH_TERLALU_BANYAK',
                            message:
                                'Program berjalan terlalu panjang (lebih dari 200 langkah). Periksa angka pada blok ULANGI ya!'
                        };
                        return;
                    }

                    const {dx, dy} = deltaForDir(dir);
                    const nx = x + dx;
                    const ny = y + dy;

                    if (checkOutOfBoundsOrWall(nx, ny)) {
                        trace.push({
                            step: stepCounter,
                            x,
                            y,
                            dir,
                            action: 'move',
                            collected_stars: Array.from(collected),
                            sound_cue: 'fail',
                            note: 'hit_wall'
                        });
                        failure = {
                            code: 'TABRAK_RINTANGAN',
                            message:
                                'Ups! Kelinci menabrak rintangan atau keluar peta. Coba periksa arah dan jumlah langkahmu ya!'
                        };
                        return;
                    }

                    x = nx;
                    y = ny;

                    if (hazardSet.has(`${x},${y}`)) {
                        trace.push({
                            step: stepCounter,
                            x,
                            y,
                            dir,
                            action: 'move',
                            collected_stars: Array.from(collected),
                            sound_cue: 'fail',
                            note: 'fell_hazard'
                        });
                        failure = {
                            code: 'KENA_BAHAYA',
                            message:
                                'Wah, ada sungai/lubang di situ! Gunakan blok LOMPAT atau cari jalan lain ya.'
                        };
                        return;
                    }

                    let cue: ChallengeStepFrame['sound_cue'] = 'step';
                    if (autoCollectOnStep && starSet.has(`${x},${y}`) && !collected.has(`${x},${y}`)) {
                        collected.add(`${x},${y}`);
                        cue = 'collect';
                    }

                    trace.push({
                        step: stepCounter,
                        x,
                        y,
                        dir,
                        action: 'move',
                        collected_stars: Array.from(collected),
                        sound_cue: cue
                    });
                }
                continue;
            }

            if (act.type === 'turn_left' || act.type === 'turn_right') {
                stepCounter += 1;
                if (stepCounter > MAX_CHALLENGE_STEPS) {
                    failure = {
                        code: 'LANGKAH_TERLALU_BANYAK',
                        message:
                            'Program berjalan terlalu panjang (lebih dari 200 langkah). Periksa angka pada blok ULANGI ya!'
                    };
                    return;
                }
                dir = act.type === 'turn_left' ? turnLeft(dir) : turnRight(dir);
                trace.push({
                    step: stepCounter,
                    x,
                    y,
                    dir,
                    action: act.type,
                    collected_stars: Array.from(collected),
                    sound_cue: 'step'
                });
                continue;
            }

            if (act.type === 'jump') {
                stepCounter += 1;
                if (stepCounter > MAX_CHALLENGE_STEPS) {
                    failure = {
                        code: 'LANGKAH_TERLALU_BANYAK',
                        message:
                            'Program berjalan terlalu panjang (lebih dari 200 langkah). Periksa angka pada blok ULANGI ya!'
                    };
                    return;
                }
                const {dx, dy} = deltaForDir(dir);
                const midX = x + dx;
                const midY = y + dy;
                const landX = x + dx * 2;
                const landY = y + dy * 2;

                // Tidak boleh melompati dinding tinggi atau mendarat di dinding / luar peta
                if (wallSet.has(`${midX},${midY}`) || checkOutOfBoundsOrWall(landX, landY)) {
                    trace.push({
                        step: stepCounter,
                        x,
                        y,
                        dir,
                        action: 'jump',
                        collected_stars: Array.from(collected),
                        sound_cue: 'fail',
                        note: 'hit_wall'
                    });
                    failure = {
                        code: 'TABRAK_RINTANGAN',
                        message:
                            'Kelinci tidak bisa melompati dinding tinggi atau keluar peta. Periksa posisi lompatanmu ya!'
                    };
                    return;
                }

                x = landX;
                y = landY;

                if (hazardSet.has(`${x},${y}`)) {
                    trace.push({
                        step: stepCounter,
                        x,
                        y,
                        dir,
                        action: 'jump',
                        collected_stars: Array.from(collected),
                        sound_cue: 'fail',
                        note: 'fell_hazard'
                    });
                    failure = {
                        code: 'KENA_BAHAYA',
                        message: 'Kelinci mendarat di atas sungai/lubang. Atur jarak sebelum melompat ya!'
                    };
                    return;
                }

                let cue: ChallengeStepFrame['sound_cue'] = 'step';
                if (autoCollectOnStep && starSet.has(`${x},${y}`) && !collected.has(`${x},${y}`)) {
                    collected.add(`${x},${y}`);
                    cue = 'collect';
                }

                trace.push({
                    step: stepCounter,
                    x,
                    y,
                    dir,
                    action: 'jump',
                    collected_stars: Array.from(collected),
                    sound_cue: cue
                });
                continue;
            }

            if (act.type === 'collect') {
                stepCounter += 1;
                if (stepCounter > MAX_CHALLENGE_STEPS) {
                    failure = {
                        code: 'LANGKAH_TERLALU_BANYAK',
                        message:
                            'Program berjalan terlalu panjang (lebih dari 200 langkah). Periksa angka pada blok ULANGI ya!'
                    };
                    return;
                }
                const key = `${x},${y}`;
                let cue: ChallengeStepFrame['sound_cue'] = 'step';
                if (starSet.has(key) && !collected.has(key)) {
                    collected.add(key);
                    cue = 'collect';
                }
                trace.push({
                    step: stepCounter,
                    x,
                    y,
                    dir,
                    action: 'collect',
                    collected_stars: Array.from(collected),
                    sound_cue: cue
                });
                continue;
            }

            if (act.type === 'repeat') {
                const loopCount = Math.max(1, Math.min(20, Math.floor(Number(act.count ?? 2)) || 2));
                const body = Array.isArray(act.body) ? act.body : [];
                for (let i = 0; i < loopCount; i++) {
                    runSequence(body, depth + 1);
                    if (failure) return;
                }
            }
        }
    }

    runSequence(actions, 0);

    if (failure) {
        const failInfo = failure as {
            code: 'TABRAK_RINTANGAN' | 'KENA_BAHAYA' | 'LANGKAH_TERLALU_BANYAK';
            message: string;
        };
        return {
            completed: false,
            reason_code: failInfo.code,
            message: failInfo.message,
            blocks_used,
            steps_taken: stepCounter,
            stars_collected: collected.size,
            stars_total: starSet.size,
            stars_earned: 0,
            trace
        };
    }

    const atGoal = x === config.goal.x && y === config.goal.y;
    const allStarsCollected = collected.size >= starSet.size;

    if (atGoal && allStarsCollected) {
        const lastFrame = trace[trace.length - 1];
        if (lastFrame) {
            lastFrame.sound_cue = 'win';
        }
        const stars_earned: 1 | 2 | 3 =
            blocks_used <= config.ideal_blocks
                ? 3
                : blocks_used <= config.ideal_blocks + 2
                  ? 2
                  : 1;
        return {
            completed: true,
            reason_code: 'BERHASIL',
            message: 'Hebat! Kelinci Penjelajah berhasil menyelesaikan misi dan sampai ke tujuan!',
            blocks_used,
            steps_taken: stepCounter,
            stars_collected: collected.size,
            stars_total: starSet.size,
            stars_earned,
            trace
        };
    }

    if (atGoal && !allStarsCollected) {
        return {
            completed: false,
            reason_code: 'BINTANG_BELUM_LENGKAP',
            message: `Kamu sudah sampai di bendera, tapi baru mengambil ${collected.size} dari ${starSet.size} bintang!`,
            blocks_used,
            steps_taken: stepCounter,
            stars_collected: collected.size,
            stars_total: starSet.size,
            stars_earned: 0,
            trace
        };
    }

    return {
        completed: false,
        reason_code: 'BELUM_SAMPAI_TUJUAN',
        message:
            'Kelinci belum sampai di bendera tujuan. Tambahkan atau ubah susunan blok perintahmu ya!',
        blocks_used,
        steps_taken: stepCounter,
        stars_collected: collected.size,
        stars_total: starSet.size,
        stars_earned: 0,
        trace
    };
}
