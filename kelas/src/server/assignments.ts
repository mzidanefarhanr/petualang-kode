import {ApiError} from '../lib/http/errors';
import type {Queryable} from '../lib/db';

export interface AssignmentFull {
    id: string;
    class_id: string;
    judul: string;
    instruksi: string | null;
    dibuka_pada: Date;
    ditutup_pada: Date;
    izinkan_terlambat: boolean;
    dibuat_pada: Date;
}

function validDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

export async function createAssignment(
    db: Queryable,
    input: {
        classId: string;
        judul: unknown;
        instruksi?: unknown;
        dibukaPada: unknown;
        ditutupPada: unknown;
        izinkanTerlambat?: unknown;
    }
): Promise<AssignmentFull> {
    const judul = typeof input.judul === 'string' ? input.judul.trim() : '';
    if (!judul) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Judul tugas wajib diisi.');
    }
    if (!validDate(input.dibukaPada) || !validDate(input.ditutupPada)) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Jendela waktu tugas tidak valid.');
    }
    if (input.ditutupPada.getTime() <= input.dibukaPada.getTime()) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'ditutup_pada harus setelah dibuka_pada.');
    }
    const instruksi = typeof input.instruksi === 'string' && input.instruksi.trim() ? input.instruksi.trim() : null;
    const izinkanTerlambat = input.izinkanTerlambat === undefined ? true : Boolean(input.izinkanTerlambat);

    const {rows} = await db.query(
        `insert into assignments (class_id, judul, instruksi, dibuka_pada, ditutup_pada, izinkan_terlambat)
         values ($1, $2, $3, $4, $5, $6)
         returning id, class_id, judul, instruksi, dibuka_pada, ditutup_pada, izinkan_terlambat, dibuat_pada`,
        [input.classId, judul, instruksi, input.dibukaPada, input.ditutupPada, izinkanTerlambat]
    );
    return rows[0];
}

export async function updateAssignment(
    db: Queryable,
    assignmentId: string,
    patch: {
        judul?: unknown;
        instruksi?: unknown;
        dibukaPada?: unknown;
        ditutupPada?: unknown;
        izinkanTerlambat?: unknown;
    }
): Promise<AssignmentFull> {
    const {rows: currentRows} = await db.query(
        `select id, judul, instruksi, dibuka_pada, ditutup_pada, izinkan_terlambat
           from assignments where id = $1`,
        [assignmentId]
    );
    const current = currentRows[0];
    if (!current) {
        throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.');
    }

    const judul = patch.judul === undefined ? current.judul : String(patch.judul).trim();
    if (!judul) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Judul tugas wajib diisi.');
    }
    const instruksi =
        patch.instruksi === undefined
            ? current.instruksi
            : typeof patch.instruksi === 'string' && patch.instruksi.trim()
              ? patch.instruksi.trim()
              : null;
    const dibukaPada = patch.dibukaPada === undefined ? current.dibuka_pada : patch.dibukaPada;
    const ditutupPada = patch.ditutupPada === undefined ? current.ditutup_pada : patch.ditutupPada;
    if (!validDate(dibukaPada) || !validDate(ditutupPada)) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Jendela waktu tugas tidak valid.');
    }
    if (ditutupPada.getTime() <= dibukaPada.getTime()) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'ditutup_pada harus setelah dibuka_pada.');
    }
    const izinkanTerlambat =
        patch.izinkanTerlambat === undefined ? current.izinkan_terlambat : Boolean(patch.izinkanTerlambat);

    const {rows} = await db.query(
        `update assignments
            set judul = $2, instruksi = $3, dibuka_pada = $4, ditutup_pada = $5, izinkan_terlambat = $6
          where id = $1
          returning id, class_id, judul, instruksi, dibuka_pada, ditutup_pada, izinkan_terlambat, dibuat_pada`,
        [assignmentId, judul, instruksi, dibukaPada, ditutupPada, izinkanTerlambat]
    );
    return rows[0];
}

export interface StudentSubmissionSummary {
    student_id: string;
    nama: string;
    jumlah_kumpul: number;
    terakhir_dikumpulkan_pada: Date | null;
    submission_id: string | null;
    terlambat: boolean | null;
    perlu_tinjauan: boolean | null;
    jumlah_snapshot: number;
    snapshot_terakhir_pada: Date | null;
    komentar_terakhir: string | null;
    belum_kumpul: boolean;
}

export interface AssignmentSubmissions {
    assignment: {id: string; class_id: string; judul: string; ditutup_pada: Date};
    murid: StudentSubmissionSummary[];
}

export async function listSubmissionsForTeacher(
    db: Queryable,
    assignmentId: string
): Promise<AssignmentSubmissions> {
    const assignment = (
        await db.query('select id, class_id, judul, ditutup_pada from assignments where id = $1', [
            assignmentId
        ])
    ).rows[0];
    if (!assignment) {
        throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.');
    }

    const {rows} = await db.query(
        `select cm.student_id, st.nama,
                coalesce(cnt.jumlah_kumpul, 0) as jumlah_kumpul,
                last.dikumpulkan_pada as terakhir_dikumpulkan_pada,
                last.id as submission_id,
                last.terlambat,
                last.perlu_tinjauan,
                coalesce(snap.jumlah_snapshot, 0) as jumlah_snapshot,
                snap.snapshot_terakhir_pada,
                kom.isi as komentar_terakhir
           from class_members cm
           join students st on st.id = cm.student_id
           left join (
               select student_id, count(*)::int as jumlah_kumpul
                 from submissions where assignment_id = $1 group by student_id
           ) cnt on cnt.student_id = cm.student_id
           left join submission_terakhir last
                  on last.assignment_id = $1 and last.student_id = cm.student_id
           left join (
               select student_id, count(*)::int as jumlah_snapshot, max(diambil_pada) as snapshot_terakhir_pada
                 from snapshots where assignment_id = $1 group by student_id
           ) snap on snap.student_id = cm.student_id
           left join lateral (
               select c.isi from comments c
                where c.submission_id = last.id
                order by c.dibuat_pada desc limit 1
           ) kom on true
          where cm.class_id = $2
          order by st.nama`,
        [assignmentId, assignment.class_id]
    );

    return {
        assignment: {
            id: assignment.id,
            class_id: assignment.class_id,
            judul: assignment.judul,
            ditutup_pada: assignment.ditutup_pada
        },
        murid: rows.map(row => ({
            student_id: row.student_id,
            nama: row.nama,
            jumlah_kumpul: Number(row.jumlah_kumpul),
            terakhir_dikumpulkan_pada: row.terakhir_dikumpulkan_pada ?? null,
            submission_id: row.submission_id ?? null,
            terlambat: row.terlambat ?? null,
            perlu_tinjauan: row.perlu_tinjauan ?? null,
            jumlah_snapshot: Number(row.jumlah_snapshot),
            snapshot_terakhir_pada: row.snapshot_terakhir_pada ?? null,
            komentar_terakhir: row.komentar_terakhir ?? null,
            belum_kumpul: Number(row.jumlah_kumpul) === 0
        }))
    };
}

export interface ClassAssignmentSummary {
    id: string;
    judul: string;
    dibuka_pada: Date;
    ditutup_pada: Date;
    jumlah_kumpul: number;
}

export async function listClassAssignments(
    db: Queryable,
    classId: string
): Promise<ClassAssignmentSummary[]> {
    const {rows} = await db.query(
        `select a.id, a.judul, a.dibuka_pada, a.ditutup_pada,
                (select count(distinct s.student_id)::int
                   from submissions s where s.assignment_id = a.id) as jumlah_kumpul
           from assignments a
          where a.class_id = $1
          order by a.ditutup_pada desc`,
        [classId]
    );
    return rows.map(row => ({
        id: row.id,
        judul: row.judul,
        dibuka_pada: row.dibuka_pada,
        ditutup_pada: row.ditutup_pada,
        jumlah_kumpul: Number(row.jumlah_kumpul)
    }));
}

export interface VersionEntry {
    jenis: 'pengumpulan' | 'snapshot';
    id: string;
    waktu: Date;
    ukuran_bytes: number;
    jenis_simpan?: string;
    url_unduh: string;
}

export interface SubmissionVersions {
    submission: {id: string; dikumpulkan_pada: Date; terlambat: boolean};
    versi: VersionEntry[];
}

export async function listVersions(db: Queryable, submissionId: string): Promise<SubmissionVersions> {
    const submission = (
        await db.query(
            'select id, assignment_id, student_id, dikumpulkan_pada, terlambat from submissions where id = $1',
            [submissionId]
        )
    ).rows[0];
    if (!submission) {
        throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.');
    }

    const submissions = (
        await db.query(
            `select id, dikumpulkan_pada as waktu, ukuran_bytes
               from submissions
              where assignment_id = $1 and student_id = $2`,
            [submission.assignment_id, submission.student_id]
        )
    ).rows;

    const snapshots = (
        await db.query(
            `select id, diambil_pada as waktu, ukuran_bytes, jenis_simpan
               from snapshots
              where assignment_id = $1 and student_id = $2`,
            [submission.assignment_id, submission.student_id]
        )
    ).rows;

    const versi: VersionEntry[] = [
        ...submissions.map(row => ({
            jenis: 'pengumpulan' as const,
            id: row.id,
            waktu: row.waktu,
            ukuran_bytes: Number(row.ukuran_bytes),
            url_unduh: `/api/v1/submissions/${row.id}/content`
        })),
        ...snapshots.map(row => ({
            jenis: 'snapshot' as const,
            id: row.id,
            waktu: row.waktu,
            ukuran_bytes: Number(row.ukuran_bytes),
            jenis_simpan: row.jenis_simpan,
            url_unduh: `/api/v1/snapshots/${row.id}/content`
        }))
    ].sort((a, b) => b.waktu.getTime() - a.waktu.getTime());

    return {
        submission: {
            id: submission.id,
            dikumpulkan_pada: submission.dikumpulkan_pada,
            terlambat: submission.terlambat
        },
        versi
    };
}
