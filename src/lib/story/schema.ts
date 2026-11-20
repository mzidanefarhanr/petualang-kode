import {MAX_STORY_DURATION_MS} from '@/lib/config';
import {ApiError} from '@/lib/http/errors';

export type StoryBackgroundTheme = 'forest' | 'meadow' | 'river' | 'night';

export interface StoryActor {
    id: string;
    name: string;
    asset_id: string | null;
    sprite_url?: string;
    initial_x: number;
    initial_y: number;
    scale: number;
    flip_x: boolean;
}

export interface StoryMoveEvent {
    id: string;
    kind: 'move';
    start_ms: number;
    end_ms: number;
    actor_id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    opacity?: number;
    flip_x?: boolean;
}

export interface StoryDialogueEvent {
    id: string;
    kind: 'dialogue';
    start_ms: number;
    end_ms: number;
    actor_id?: string | null;
    speaker: string;
    text: string;
}

export interface StoryAudioEvent {
    id: string;
    kind: 'audio';
    start_ms: number;
    end_ms: number;
    asset_id: string;
    label?: string;
    volume: number;
    loop: boolean;
}

export type StoryTimelineEvent = StoryMoveEvent | StoryDialogueEvent | StoryAudioEvent;

export interface StoryConfig {
    duration_ms: number;
    background_theme: StoryBackgroundTheme;
    background_asset_id: string | null;
    actors: StoryActor[];
    timeline: StoryTimelineEvent[];
}

function clamp(num: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, num));
}

export function defaultStoryConfig(): StoryConfig {
    return {
        duration_ms: 8000,
        background_theme: 'forest',
        background_asset_id: null,
        actors: [
            {
                id: 'kelinci',
                name: 'Kelinci Penjelajah',
                asset_id: null,
                sprite_url: '/mascot/00-kelinci-penjelajah-utama.jpg',
                initial_x: 18,
                initial_y: 68,
                scale: 1,
                flip_x: false
            }
        ],
        timeline: [
            {
                id: 'ev-move-1',
                kind: 'move',
                start_ms: 0,
                end_ms: 4500,
                actor_id: 'kelinci',
                from_x: 18,
                from_y: 68,
                to_x: 54,
                to_y: 68,
                opacity: 1,
                flip_x: false
            },
            {
                id: 'ev-dlg-1',
                kind: 'dialogue',
                start_ms: 500,
                end_ms: 7500,
                actor_id: 'kelinci',
                speaker: 'Kelinci Penjelajah',
                text: 'Kita harus menyeberangi hutan kode sebelum malam tiba. Ayo perhatikan peta di depan!'
            }
        ]
    };
}

export function validateStoryConfig(raw: unknown): StoryConfig {
    if (!raw || typeof raw !== 'object') {
        throw new ApiError(400, 'STORY_CONFIG_TIDAK_VALID', 'Konfigurasi stage cerita tidak valid.');
    }
    const obj = raw as Record<string, unknown>;

    const durationRaw = Number(obj.duration_ms ?? 8000);
    if (!Number.isFinite(durationRaw) || durationRaw < 1000 || durationRaw > MAX_STORY_DURATION_MS) {
        throw new ApiError(
            400,
            'DURASI_STORY_TIDAK_VALID',
            `Durasi timeline cerita harus antara 1 hingga ${MAX_STORY_DURATION_MS / 1000} detik.`
        );
    }
    const duration_ms = Math.round(durationRaw);

    const allowedThemes: StoryBackgroundTheme[] = ['forest', 'meadow', 'river', 'night'];
    const background_theme: StoryBackgroundTheme = allowedThemes.includes(
        obj.background_theme as StoryBackgroundTheme
    )
        ? (obj.background_theme as StoryBackgroundTheme)
        : 'forest';

    const background_asset_id =
        typeof obj.background_asset_id === 'string' && obj.background_asset_id.trim().length > 0
            ? obj.background_asset_id.trim()
            : null;

    if (!Array.isArray(obj.actors) || obj.actors.length === 0 || obj.actors.length > 12) {
        throw new ApiError(
            400,
            'AKTOR_STORY_TIDAK_VALID',
            'Stage cerita harus memiliki antara 1 hingga 12 aktor/gambar bergerak.'
        );
    }

    const actorIds = new Set<string>();
    const actors: StoryActor[] = obj.actors.map((a, idx) => {
        if (!a || typeof a !== 'object') {
            throw new ApiError(400, 'AKTOR_STORY_TIDAK_VALID', `Data aktor ke-${idx + 1} tidak valid.`);
        }
        const item = a as Record<string, unknown>;
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `actor-${idx + 1}`;
        const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Aktor ${idx + 1}`;
        actorIds.add(id);

        return {
            id,
            name,
            asset_id:
                typeof item.asset_id === 'string' && item.asset_id.trim().length > 0
                    ? item.asset_id.trim()
                    : null,
            sprite_url:
                typeof item.sprite_url === 'string' && item.sprite_url.trim().length > 0
                    ? item.sprite_url.trim()
                    : undefined,
            initial_x: clamp(Number(item.initial_x ?? 20), 0, 100),
            initial_y: clamp(Number(item.initial_y ?? 65), 0, 100),
            scale: clamp(Number(item.scale ?? 1), 0.2, 3),
            flip_x: Boolean(item.flip_x)
        };
    });

    const rawTimeline = Array.isArray(obj.timeline) ? obj.timeline : [];
    if (rawTimeline.length > 60) {
        throw new ApiError(400, 'TIMELINE_TERLALU_BANYAK', 'Timeline maksimal berisi 60 event.');
    }

    const timeline: StoryTimelineEvent[] = rawTimeline.map((ev, idx) => {
        if (!ev || typeof ev !== 'object') {
            throw new ApiError(400, 'EVENT_TIMELINE_TIDAK_VALID', `Event timeline ke-${idx + 1} tidak valid.`);
        }
        const item = ev as Record<string, unknown>;
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `ev-${idx + 1}`;
        const start_ms = Math.round(Number(item.start_ms ?? 0));
        const end_ms = Math.round(Number(item.end_ms ?? start_ms + 1000));

        if (!Number.isFinite(start_ms) || !Number.isFinite(end_ms) || start_ms < 0 || end_ms <= start_ms || end_ms > duration_ms) {
            throw new ApiError(
                400,
                'WAKTU_TIMELINE_TIDAK_VALID',
                `Rentang waktu event "${id}" harus berada di dalam durasi stage (0..${duration_ms} ms).`
            );
        }

        if (item.kind === 'move') {
            const actor_id = typeof item.actor_id === 'string' ? item.actor_id.trim() : '';
            if (!actorIds.has(actor_id)) {
                throw new ApiError(
                    400,
                    'AKTOR_EVENT_TIDAK_DITEMUKAN',
                    `Aktor "${actor_id}" pada event gerak tidak ditemukan.`
                );
            }
            return {
                id,
                kind: 'move',
                start_ms,
                end_ms,
                actor_id,
                from_x: clamp(Number(item.from_x ?? 0), 0, 100),
                from_y: clamp(Number(item.from_y ?? 0), 0, 100),
                to_x: clamp(Number(item.to_x ?? 0), 0, 100),
                to_y: clamp(Number(item.to_y ?? 0), 0, 100),
                opacity: item.opacity === undefined ? 1 : clamp(Number(item.opacity), 0, 1),
                flip_x: item.flip_x === undefined ? undefined : Boolean(item.flip_x)
            };
        }

        if (item.kind === 'dialogue') {
            const speaker = typeof item.speaker === 'string' && item.speaker.trim() ? item.speaker.trim() : 'Narator';
            const text = typeof item.text === 'string' ? item.text.trim() : '';
            if (!text || text.length > 400) {
                throw new ApiError(
                    400,
                    'DIALOG_TIDAK_VALID',
                    'Teks dialog wajib diisi (maksimal 400 karakter).'
                );
            }
            return {
                id,
                kind: 'dialogue',
                start_ms,
                end_ms,
                actor_id: typeof item.actor_id === 'string' ? item.actor_id.trim() : null,
                speaker,
                text
            };
        }

        if (item.kind === 'audio') {
            const asset_id = typeof item.asset_id === 'string' ? item.asset_id.trim() : '';
            if (!asset_id) {
                throw new ApiError(400, 'AUDIO_ASSET_WAJIB', 'Event suara wajib memilih aset audio.');
            }
            return {
                id,
                kind: 'audio',
                start_ms,
                end_ms,
                asset_id,
                label: typeof item.label === 'string' ? item.label.trim() : undefined,
                volume: clamp(Number(item.volume ?? 0.85), 0, 1),
                loop: Boolean(item.loop)
            };
        }

        throw new ApiError(400, 'JENIS_EVENT_TIDAK_DIKENAL', 'Jenis event timeline harus move, dialogue, atau audio.');
    });

    timeline.sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);

    return {
        duration_ms,
        background_theme,
        background_asset_id,
        actors,
        timeline
    };
}

export interface ComputedActorFrame {
    id: string;
    name: string;
    asset_id: string | null;
    sprite_url?: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    flip_x: boolean;
}

export interface ComputedStoryFrame {
    time_ms: number;
    actors: ComputedActorFrame[];
    dialogues: StoryDialogueEvent[];
    active_audios: StoryAudioEvent[];
}

export function computeStoryFrameAt(config: StoryConfig, rawTimeMs: number): ComputedStoryFrame {
    const time_ms = clamp(rawTimeMs, 0, config.duration_ms);

    const actors: ComputedActorFrame[] = config.actors.map(actor => {
        let x = actor.initial_x;
        let y = actor.initial_y;
        let opacity = 1;
        let flip_x = actor.flip_x;

        const moveEvents = config.timeline.filter(
            (ev): ev is StoryMoveEvent => ev.kind === 'move' && ev.actor_id === actor.id
        );

        for (const mv of moveEvents) {
            if (time_ms >= mv.end_ms) {
                x = mv.to_x;
                y = mv.to_y;
                if (mv.opacity !== undefined) opacity = mv.opacity;
                if (mv.flip_x !== undefined) flip_x = mv.flip_x;
            } else if (time_ms >= mv.start_ms) {
                const span = Math.max(1, mv.end_ms - mv.start_ms);
                const progress = (time_ms - mv.start_ms) / span;
                x = mv.from_x + (mv.to_x - mv.from_x) * progress;
                y = mv.from_y + (mv.to_y - mv.from_y) * progress;
                if (mv.opacity !== undefined) opacity = mv.opacity;
                if (mv.flip_x !== undefined) flip_x = mv.flip_x;
            }
        }

        return {
            id: actor.id,
            name: actor.name,
            asset_id: actor.asset_id,
            sprite_url: actor.sprite_url,
            x,
            y,
            scale: actor.scale,
            opacity,
            flip_x
        };
    });

    const dialogues = config.timeline.filter(
        (ev): ev is StoryDialogueEvent =>
            ev.kind === 'dialogue' && time_ms >= ev.start_ms && time_ms <= ev.end_ms
    );

    const active_audios = config.timeline.filter(
        (ev): ev is StoryAudioEvent =>
            ev.kind === 'audio' && time_ms >= ev.start_ms && time_ms <= ev.end_ms
    );

    return {
        time_ms,
        actors,
        dialogues,
        active_audios
    };
}
