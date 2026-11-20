import {
    defaultChallengeConfig,
    validateChallengeConfig
} from '@/lib/challenge/engine';
import {withTransaction, type Queryable} from '@/lib/db';
import {ApiError, assertValidUuid} from '@/lib/http/errors';
import {defaultStoryConfig, validateStoryConfig} from '@/lib/story/schema';

export interface LessonSummary {
    id: string;
    judul: string;
    deskripsi: string | null;
    dibuat_pada: Date;
    diperbarui_pada: Date;
    jumlah_stage: number;
}

export interface StageRow {
    id: string;
    lesson_id: string;
    urutan: number;
    judul: string;
    tipe: 'story' | 'challenge';
    config: Record<string, unknown>;
    dibuat_pada: Date;
    diperbarui_pada: Date;
}

export async function assertAdminOwnsLesson(
    db: Queryable,
    adminId: string,
    lessonId: string
): Promise<{id: string; judul: string; deskripsi: string | null; dibuat_pada: Date; diperbarui_pada: Date}> {
    assertValidUuid(lessonId, 'Pelajaran tidak ditemukan.');
    const {rows} = await db.query(
        `select id, judul, deskripsi, dibuat_pada, diperbarui_pada
         from lessons
         where id = $1 and admin_id = $2`,
        [lessonId, adminId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'PELAJARAN_TIDAK_DITEMUKAN', 'Pelajaran tidak ditemukan.');
    }
    return rows[0];
}

export async function assertAdminOwnsStage(
    db: Queryable,
    adminId: string,
    stageId: string
): Promise<StageRow> {
    assertValidUuid(stageId, 'Stage tidak ditemukan.');
    const {rows} = await db.query(
        `select s.id, s.lesson_id, s.urutan, s.judul, s.tipe, s.config, s.dibuat_pada, s.diperbarui_pada
         from stages s
         join lessons l on l.id = s.lesson_id
         where s.id = $1 and l.admin_id = $2`,
        [stageId, adminId]
    );
    if (!rows[0]) {
        throw new ApiError(404, 'STAGE_TIDAK_DITEMUKAN', 'Stage tidak ditemukan.');
    }
    return rows[0];
}

export async function listAdminLessons(db: Queryable, adminId: string): Promise<LessonSummary[]> {
    const {rows} = await db.query(
        `select
            l.id,
            l.judul,
            l.deskripsi,
            l.dibuat_pada,
            l.diperbarui_pada,
            count(s.id)::int as jumlah_stage
         from lessons l
         left join stages s on s.lesson_id = l.id
         where l.admin_id = $1
         group by l.id
         order by l.diperbarui_pada desc`,
        [adminId]
    );
    return rows;
}

export async function createAdminLesson(
    db: Queryable,
    adminId: string,
    input: {judul?: unknown; deskripsi?: unknown}
) {
    const judul = typeof input.judul === 'string' ? input.judul.trim() : '';
    const deskripsi =
        typeof input.deskripsi === 'string' && input.deskripsi.trim().length > 0
            ? input.deskripsi.trim()
            : null;

    if (!judul || judul.length > 120) {
        throw new ApiError(400, 'INPUT_TIDAK_VALID', 'Judul pelajaran wajib diisi (maks. 120 karakter).');
    }

    const {rows} = await db.query(
        `insert into lessons (admin_id, judul, deskripsi)
         values ($1, $2, $3)
         returning id, judul, deskripsi, dibuat_pada, diperbarui_pada`,
        [adminId, judul, deskripsi]
    );
    return rows[0];
}

export async function getAdminLessonDetail(db: Queryable, adminId: string, lessonId: string) {
    const lesson = await assertAdminOwnsLesson(db, adminId, lessonId);
    const {rows: stages} = await db.query(
        `select id, lesson_id, urutan, judul, tipe, config, dibuat_pada, diperbarui_pada
         from stages
         where lesson_id = $1
         order by urutan asc`,
        [lessonId]
    );
    return {lesson, stages: stages as StageRow[]};
}

export async function updateAdminLesson(
    db: Queryable,
    adminId: string,
    lessonId: string,
    input: {judul?: unknown; deskripsi?: unknown}
) {
    const existing = await assertAdminOwnsLesson(db, adminId, lessonId);
    const judul =
        typeof input.judul === 'string' && input.judul.trim().length > 0 ? input.judul.trim() : existing.judul;
    const deskripsi =
        input.deskripsi === undefined
            ? existing.deskripsi
            : typeof input.deskripsi === 'string' && input.deskripsi.trim().length > 0
              ? input.deskripsi.trim()
              : null;

    const {rows} = await db.query(
        `update lessons
         set judul = $1, deskripsi = $2, diperbarui_pada = now()
         where id = $3 and admin_id = $4
         returning id, judul, deskripsi, dibuat_pada, diperbarui_pada`,
        [judul, deskripsi, lessonId, adminId]
    );
    return rows[0];
}

export async function deleteAdminLesson(db: Queryable, adminId: string, lessonId: string): Promise<void> {
    await assertAdminOwnsLesson(db, adminId, lessonId);
    await db.query('delete from lessons where id = $1 and admin_id = $2', [lessonId, adminId]);
}

function normalizeStageConfig(tipe: 'story' | 'challenge', rawConfig: unknown): unknown {
    if (tipe === 'story') {
        const cfg = rawConfig && typeof rawConfig === 'object' && Object.keys(rawConfig).length > 0
            ? rawConfig
            : defaultStoryConfig();
        return validateStoryConfig(cfg);
    }
    const cfg =
        rawConfig && typeof rawConfig === 'object' && Object.keys(rawConfig).length > 0
            ? rawConfig
            : defaultChallengeConfig();
    return validateChallengeConfig(cfg);
}

export async function createAdminStage(
    db: Queryable,
    adminId: string,
    lessonId: string,
    input: {judul?: unknown; tipe?: unknown; config?: unknown}
): Promise<StageRow> {
    await assertAdminOwnsLesson(db, adminId, lessonId);

    const judul = typeof input.judul === 'string' ? input.judul.trim() : '';
    if (!judul || judul.length > 120) {
        throw new ApiError(400, 'INPUT_TIDAK_VALID', 'Judul stage wajib diisi (maks. 120 karakter).');
    }
    if (input.tipe !== 'story' && input.tipe !== 'challenge') {
        throw new ApiError(400, 'TIPE_STAGE_TIDAK_VALID', 'Tipe stage harus story atau challenge.');
    }

    const validConfig = normalizeStageConfig(input.tipe, input.config);

    return withTransaction(db, async tx => {
        const maxRes = await tx.query(
            'select coalesce(max(urutan), 0)::int as max_urutan from stages where lesson_id = $1',
            [lessonId]
        );
        const nextUrutan = Number(maxRes.rows[0]?.max_urutan ?? 0) + 1;

        const {rows} = await tx.query(
            `insert into stages (lesson_id, urutan, judul, tipe, config)
             values ($1, $2, $3, $4, $5::jsonb)
             returning id, lesson_id, urutan, judul, tipe, config, dibuat_pada, diperbarui_pada`,
            [lessonId, nextUrutan, judul, input.tipe, JSON.stringify(validConfig)]
        );
        await tx.query('update lessons set diperbarui_pada = now() where id = $1', [lessonId]);
        return rows[0];
    });
}

export async function updateAdminStage(
    db: Queryable,
    adminId: string,
    stageId: string,
    input: {judul?: unknown; config?: unknown}
): Promise<StageRow> {
    const existing = await assertAdminOwnsStage(db, adminId, stageId);

    const judul =
        typeof input.judul === 'string' && input.judul.trim().length > 0 ? input.judul.trim() : existing.judul;
    const validConfig =
        input.config !== undefined ? normalizeStageConfig(existing.tipe, input.config) : existing.config;

    const {rows} = await db.query(
        `update stages
         set judul = $1, config = $2::jsonb, diperbarui_pada = now()
         where id = $3
         returning id, lesson_id, urutan, judul, tipe, config, dibuat_pada, diperbarui_pada`,
        [judul, JSON.stringify(validConfig), stageId]
    );
    await db.query('update lessons set diperbarui_pada = now() where id = $1', [existing.lesson_id]);
    return rows[0];
}

export async function deleteAdminStage(db: Queryable, adminId: string, stageId: string): Promise<void> {
    const existing = await assertAdminOwnsStage(db, adminId, stageId);

    await withTransaction(db, async tx => {
        await tx.query('delete from stages where id = $1', [stageId]);
        // Rapikan urutan 1..N
        const remaining = await tx.query(
            'select id from stages where lesson_id = $1 order by urutan asc',
            [existing.lesson_id]
        );
        for (let i = 0; i < remaining.rows.length; i++) {
            await tx.query('update stages set urutan = $1 where id = $2', [
                i + 1,
                remaining.rows[i].id
            ]);
        }
        await tx.query('update lessons set diperbarui_pada = now() where id = $1', [existing.lesson_id]);
    });
}

export async function reorderAdminStages(
    db: Queryable,
    adminId: string,
    lessonId: string,
    stageIds: unknown
): Promise<StageRow[]> {
    await assertAdminOwnsLesson(db, adminId, lessonId);
    if (!Array.isArray(stageIds) || stageIds.length === 0) {
        throw new ApiError(400, 'URUTAN_TIDAK_VALID', 'Daftar stage_ids tidak boleh kosong.');
    }

    return withTransaction(db, async tx => {
        const current = await tx.query(
            'select id from stages where lesson_id = $1 order by urutan asc',
            [lessonId]
        );
        const currentIds = new Set(current.rows.map(r => r.id));

        if (currentIds.size !== stageIds.length || stageIds.some(id => typeof id !== 'string' || !currentIds.has(id))) {
            throw new ApiError(
                400,
                'URUTAN_TIDAK_LENGKAP',
                'Daftar stage_ids harus mencakup seluruh stage pada pelajaran ini.'
            );
        }

        for (let i = 0; i < stageIds.length; i++) {
            await tx.query(
                'update stages set urutan = $1, diperbarui_pada = now() where id = $2 and lesson_id = $3',
                [i + 1, stageIds[i], lessonId]
            );
        }
        await tx.query('update lessons set diperbarui_pada = now() where id = $1', [lessonId]);

        const updated = await tx.query(
            `select id, lesson_id, urutan, judul, tipe, config, dibuat_pada, diperbarui_pada
             from stages
             where lesson_id = $1
             order by urutan asc`,
            [lessonId]
        );
        return updated.rows;
    });
}
