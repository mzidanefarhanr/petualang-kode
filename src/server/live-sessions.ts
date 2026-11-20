import {assertAdminOwnsClass, assertStudentInClass} from '@/lib/access';
import {
    evaluateChallenge,
    validateChallengeConfig,
    type ChallengeAction
} from '@/lib/challenge/engine';
import {MAX_LIVE_STUDENTS} from '@/lib/config';
import type {Queryable} from '@/lib/db';
import {ApiError, assertValidUuid} from '@/lib/http/errors';
import {getWsHub} from '@/ws/hub';
import {assertAdminOwnsLesson} from './lessons';

export interface LiveSessionStatePayload {
    session_id: string;
    class_id: string;
    kelas_nama: string;
    lesson_id: string;
    lesson_judul: string;
    status: 'active' | 'ended';
    maks_siswa: number;
    active_stage: {
        id: string;
        urutan: number;
        total_stages: number;
        judul: string;
        tipe: 'story' | 'challenge';
        config: Record<string, unknown>;
    };
    playback: {
        status: 'idle' | 'playing' | 'paused';
        offset_ms: number;
        updated_at_ms: number;
        server_time_ms: number;
    };
    challenge_locked: boolean;
}

export async function getLiveSessionStatePayload(
    db: Queryable,
    sessionId: string
): Promise<LiveSessionStatePayload> {
    assertValidUuid(sessionId, 'Sesi live tidak ditemukan.');

    const {rows} = await db.query(
        `select
            ls.id as session_id,
            ls.class_id,
            c.nama as kelas_nama,
            ls.lesson_id,
            l.judul as lesson_judul,
            ls.status,
            ls.maks_siswa,
            ls.playback_status,
            ls.playback_offset_ms,
            extract(epoch from ls.playback_updated_at)::bigint * 1000 as updated_at_ms,
            extract(epoch from now())::bigint * 1000 as server_time_ms,
            ls.challenge_locked,
            st.id as stage_id,
            st.urutan as stage_urutan,
            st.judul as stage_judul,
            st.tipe as stage_tipe,
            st.config as stage_config,
            (select count(*)::int from stages where lesson_id = ls.lesson_id) as total_stages
         from live_sessions ls
         join classes c on c.id = ls.class_id
         join lessons l on l.id = ls.lesson_id
         join stages st on st.id = ls.active_stage_id
         where ls.id = $1`,
        [sessionId]
    );

    const row = rows[0];
    if (!row) {
        throw new ApiError(404, 'SESI_TIDAK_DITEMUKAN', 'Sesi live tidak ditemukan.');
    }

    return {
        session_id: row.session_id,
        class_id: row.class_id,
        kelas_nama: row.kelas_nama,
        lesson_id: row.lesson_id,
        lesson_judul: row.lesson_judul,
        status: row.status,
        maks_siswa: Number(row.maks_siswa),
        active_stage: {
            id: row.stage_id,
            urutan: Number(row.stage_urutan),
            total_stages: Number(row.total_stages),
            judul: row.stage_judul,
            tipe: row.stage_tipe,
            config: (row.stage_config || {}) as Record<string, unknown>
        },
        playback: {
            status: row.playback_status,
            offset_ms: Number(row.playback_offset_ms),
            updated_at_ms: Number(row.updated_at_ms),
            server_time_ms: Number(row.server_time_ms)
        },
        challenge_locked: Boolean(row.challenge_locked)
    };
}

export async function startAdminLiveSession(
    db: Queryable,
    adminId: string,
    input: {class_id?: unknown; lesson_id?: unknown; active_stage_id?: unknown}
) {
    const classId = typeof input.class_id === 'string' ? input.class_id.trim() : '';
    const lessonId = typeof input.lesson_id === 'string' ? input.lesson_id.trim() : '';
    const requestedStageId =
        typeof input.active_stage_id === 'string' && input.active_stage_id.trim().length > 0
            ? input.active_stage_id.trim()
            : null;

    const kelas = await assertAdminOwnsClass(db, adminId, classId);
    if (kelas.diarsipkan_pada) {
        throw new ApiError(400, 'KELAS_DIARSIPKAN', 'Kelas yang sudah diarsipkan tidak dapat memulai sesi live.');
    }
    await assertAdminOwnsLesson(db, adminId, lessonId);

    const existingActive = await db.query(
        `select id from live_sessions where class_id = $1 and status = 'active' limit 1`,
        [classId]
    );
    if (existingActive.rows[0]) {
        throw new ApiError(
            409,
            'SESI_SUDAH_AKTIF',
            'Kelas ini sudah memiliki sesi live yang sedang berlangsung.',
            {session_id: existingActive.rows[0].id}
        );
    }

    const stagesRes = await db.query(
        'select id, urutan from stages where lesson_id = $1 order by urutan asc',
        [lessonId]
    );
    if (stagesRes.rows.length === 0) {
        throw new ApiError(
            400,
            'PELAJARAN_TANPA_STAGE',
            'Pelajaran ini belum memiliki stage. Tambahkan minimal 1 stage terlebih dahulu.'
        );
    }

    let initialStageId = stagesRes.rows[0].id as string;
    if (requestedStageId) {
        const found = stagesRes.rows.find(s => s.id === requestedStageId);
        if (!found) {
            throw new ApiError(400, 'STAGE_TIDAK_SESUAI', 'Stage awal tidak termasuk dalam pelajaran ini.');
        }
        initialStageId = found.id;
    }

    const {rows} = await db.query(
        `insert into live_sessions (
            admin_id, class_id, lesson_id, active_stage_id, status, maks_siswa
         )
         values ($1, $2, $3, $4, 'active', $5)
         returning id`,
        [adminId, classId, lessonId, initialStageId, MAX_LIVE_STUDENTS]
    );

    const sessionId = rows[0].id as string;
    const state = await getLiveSessionStatePayload(db, sessionId);

    const hub = getWsHub();
    hub.broadcastToSession(sessionId, {type: 'session:state', payload: state as unknown as Record<string, unknown>});
    hub.broadcastToClass(classId, {type: 'session:state', payload: state as unknown as Record<string, unknown>});

    return state;
}

export async function getAdminLiveSessionDetail(
    db: Queryable,
    adminId: string,
    sessionId: string
) {
    assertValidUuid(sessionId, 'Sesi live tidak ditemukan.');

    const ownerCheck = await db.query(
        'select id, class_id, lesson_id, active_stage_id from live_sessions where id = $1 and admin_id = $2',
        [sessionId, adminId]
    );
    if (!ownerCheck.rows[0]) {
        throw new ApiError(404, 'SESI_TIDAK_DITEMUKAN', 'Sesi live tidak ditemukan.');
    }

    const state = await getLiveSessionStatePayload(db, sessionId);

    const [stagesRes, studentsRes] = await Promise.all([
        db.query(
            `select id, urutan, judul, tipe
             from stages
             where lesson_id = $1
             order by urutan asc`,
            [state.lesson_id]
        ),
        db.query(
            `select
                s.id,
                s.nama,
                s.username,
                p.status as progress_status,
                coalesce(p.attempts, 0)::int as attempts,
                p.blocks_used,
                p.completed_at
             from class_members cm
             join students s on s.id = cm.student_id
             left join student_stage_progress p
               on p.live_session_id = $1
              and p.stage_id = $2
              and p.student_id = s.id
             where cm.class_id = $3
               and s.diarsipkan_pada is null
             order by s.nama asc`,
            [sessionId, state.active_stage.id, state.class_id]
        )
    ]);

    const connectedSet = new Set(getWsHub().getConnectedStudentIds(sessionId));

    const students = studentsRes.rows.map(r => ({
        id: r.id as string,
        nama: r.nama as string,
        username: r.username as string,
        online: connectedSet.has(r.id),
        progress_status: (r.progress_status as 'in_progress' | 'completed' | null) ?? null,
        attempts: Number(r.attempts ?? 0),
        blocks_used: r.blocks_used !== null && r.blocks_used !== undefined ? Number(r.blocks_used) : null,
        completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null
    }));

    return {
        state,
        stages: stagesRes.rows as Array<{id: string; urutan: number; judul: string; tipe: 'story' | 'challenge'}>,
        students
    };
}

export async function controlAdminLiveSession(
    db: Queryable,
    adminId: string,
    sessionId: string,
    input: {
        action?: unknown;
        stage_id?: unknown;
        playback_status?: unknown;
        offset_ms?: unknown;
        challenge_locked?: unknown;
    }
): Promise<LiveSessionStatePayload> {
    assertValidUuid(sessionId, 'Sesi live tidak ditemukan.');

    const {rows} = await db.query(
        'select id, class_id, lesson_id, status from live_sessions where id = $1 and admin_id = $2',
        [sessionId, adminId]
    );
    const session = rows[0];
    if (!session) {
        throw new ApiError(404, 'SESI_TIDAK_DITEMUKAN', 'Sesi live tidak ditemukan.');
    }
    if (session.status !== 'active') {
        throw new ApiError(409, 'SESI_SUDAH_BERAKHIR', 'Sesi live ini sudah diakhiri.');
    }

    if (input.action === 'set_stage') {
        const stageId = typeof input.stage_id === 'string' ? input.stage_id.trim() : '';
        assertValidUuid(stageId, 'Stage tidak ditemukan.');

        const stageCheck = await db.query(
            'select id from stages where id = $1 and lesson_id = $2',
            [stageId, session.lesson_id]
        );
        if (!stageCheck.rows[0]) {
            throw new ApiError(400, 'STAGE_TIDAK_SESUAI', 'Stage tidak termasuk dalam pelajaran sesi ini.');
        }

        await db.query(
            `update live_sessions
             set active_stage_id = $1,
                 playback_status = 'idle',
                 playback_offset_ms = 0,
                 playback_updated_at = now()
             where id = $2`,
            [stageId, sessionId]
        );
    } else if (input.action === 'playback') {
        const status = input.playback_status;
        if (status !== 'idle' && status !== 'playing' && status !== 'paused') {
            throw new ApiError(400, 'PLAYBACK_TIDAK_VALID', 'Status playback harus idle, playing, atau paused.');
        }
        const offsetRaw = Number(input.offset_ms ?? 0);
        const offsetMs = Number.isFinite(offsetRaw) ? Math.max(0, Math.min(300_000, Math.round(offsetRaw))) : 0;

        await db.query(
            `update live_sessions
             set playback_status = $1,
                 playback_offset_ms = $2,
                 playback_updated_at = now()
             where id = $3`,
            [status, offsetMs, sessionId]
        );
    } else if (input.action === 'set_lock') {
        const locked = Boolean(input.challenge_locked);
        await db.query(
            'update live_sessions set challenge_locked = $1 where id = $2',
            [locked, sessionId]
        );
    } else {
        throw new ApiError(400, 'AKSI_TIDAK_DIKENAL', 'Aksi kontrol harus set_stage, playback, atau set_lock.');
    }

    const updatedState = await getLiveSessionStatePayload(db, sessionId);
    const hub = getWsHub();
    hub.broadcastToSession(sessionId, {
        type: 'session:state',
        payload: updatedState as unknown as Record<string, unknown>
    });
    hub.broadcastToClass(session.class_id, {
        type: 'session:state',
        payload: updatedState as unknown as Record<string, unknown>
    });

    return updatedState;
}

export async function endAdminLiveSession(
    db: Queryable,
    adminId: string,
    sessionId: string
): Promise<{id: string; status: 'ended'}> {
    assertValidUuid(sessionId, 'Sesi live tidak ditemukan.');

    const {rows} = await db.query(
        `update live_sessions
         set status = 'ended',
             playback_status = 'idle',
             diakhiri_pada = coalesce(diakhiri_pada, now())
         where id = $1 and admin_id = $2
         returning id, class_id, status`,
        [sessionId, adminId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'SESI_TIDAK_DITEMUKAN', 'Sesi live tidak ditemukan.');
    }

    const hub = getWsHub();
    hub.broadcastToSession(sessionId, {
        type: 'session:ended',
        payload: {session_id: sessionId}
    });
    hub.broadcastToClass(rows[0].class_id, {
        type: 'session:ended',
        payload: {session_id: sessionId}
    });

    return {id: rows[0].id, status: 'ended'};
}

export async function getStudentActiveClassLiveSession(
    db: Queryable,
    studentId: string,
    classId: string
): Promise<{
    kelas: {id: string; nama: string; admin_id: string};
    session: LiveSessionStatePayload | null;
}> {
    const kelas = await assertStudentInClass(db, studentId, classId);
    const {rows} = await db.query(
        `select id from live_sessions where class_id = $1 and status = 'active' limit 1`,
        [classId]
    );
    if (!rows[0]) {
        return {kelas, session: null};
    }
    const session = await getLiveSessionStatePayload(db, rows[0].id);
    return {kelas, session};
}

export async function submitStudentChallengeProgress(
    db: Queryable,
    studentId: string,
    sessionId: string,
    input: {stage_id?: unknown; actions?: unknown}
) {
    assertValidUuid(sessionId, 'Sesi live tidak ditemukan.');

    const {rows} = await db.query(
        `select id, class_id, active_stage_id, status, challenge_locked
         from live_sessions
         where id = $1`,
        [sessionId]
    );
    const session = rows[0];
    if (!session) {
        throw new ApiError(404, 'SESI_TIDAK_DITEMUKAN', 'Sesi live tidak ditemukan.');
    }

    await assertStudentInClass(db, studentId, session.class_id);

    if (session.status !== 'active') {
        throw new ApiError(409, 'SESI_SUDAH_BERAKHIR', 'Sesi pelajaran ini sudah berakhir.');
    }

    const stageId = typeof input.stage_id === 'string' ? input.stage_id.trim() : '';
    if (stageId !== session.active_stage_id) {
        throw new ApiError(
            403,
            'STAGE_TIDAK_AKTIF',
            'Kamu hanya dapat mengerjakan stage yang sedang ditampilkan pengajar.'
        );
    }

    if (session.challenge_locked) {
        throw new ApiError(
            403,
            'STAGE_DIKUNCI',
            'Tantangan sedang dikunci oleh pengajar. Perhatikan penjelasan pengajar dulu ya!'
        );
    }

    const stageRes = await db.query(
        'select id, tipe, config from stages where id = $1',
        [session.active_stage_id]
    );
    const stage = stageRes.rows[0];
    if (!stage || stage.tipe !== 'challenge') {
        throw new ApiError(400, 'BUKAN_STAGE_CHALLENGE', 'Stage aktif saat ini bukan stage challenge.');
    }

    const challengeConfig = validateChallengeConfig(stage.config);
    const actions = Array.isArray(input.actions) ? (input.actions as ChallengeAction[]) : [];
    const evaluation = evaluateChallenge(challengeConfig, actions);

    const statusValue: 'in_progress' | 'completed' = evaluation.completed ? 'completed' : 'in_progress';

    const upsertRes = await db.query(
        `insert into student_stage_progress (
            live_session_id, stage_id, student_id, status, attempts, blocks_used, program_json, completed_at, updated_at
         )
         values (
            $1, $2, $3, $4, 1, $5, $6::jsonb,
            case when $4 = 'completed' then now() else null end,
            now()
         )
         on conflict (live_session_id, stage_id, student_id)
         do update set
            attempts = student_stage_progress.attempts + 1,
            status = case
                when student_stage_progress.status = 'completed' then 'completed'
                else excluded.status
            end,
            blocks_used = excluded.blocks_used,
            program_json = excluded.program_json,
            completed_at = case
                when student_stage_progress.completed_at is not null then student_stage_progress.completed_at
                when excluded.status = 'completed' then now()
                else null
            end,
            updated_at = now()
         returning status, attempts, blocks_used, completed_at`,
        [sessionId, stage.id, studentId, statusValue, evaluation.blocks_used, JSON.stringify(actions)]
    );

    const progress = upsertRes.rows[0];

    getWsHub().broadcastToSession(sessionId, {
        type: 'student:progress',
        payload: {
            session_id: sessionId,
            stage_id: stage.id,
            student_id: studentId,
            status: progress.status,
            attempts: Number(progress.attempts),
            blocks_used: Number(progress.blocks_used)
        }
    });

    return {
        progress: {
            status: progress.status as 'in_progress' | 'completed',
            attempts: Number(progress.attempts),
            blocks_used: Number(progress.blocks_used),
            completed_at: progress.completed_at
        },
        evaluation
    };
}
