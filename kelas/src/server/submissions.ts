import {ApiError, Errors} from '../lib/http/errors';
import {evaluateAssignmentWindow} from '../lib/assignment-window';
import {loadAssignmentForStudent} from '../lib/assignment';
import {withTransaction, type Queryable} from '../lib/db';
import {newId} from '../lib/files';
import {saveSnapshot} from './snapshots';
import type {Deps} from './deps';

export interface CreateSubmissionInput {
    assignmentId: string;
    studentId: string;
    snapshotId?: string | null;
    bytes?: Uint8Array | null;
    catatanSiswa?: string | null;
    idempotencyKey?: string | null;
}

export interface SubmissionResult {
    submission_id: string;
    dikumpulkan_pada: Date;
    terlambat: boolean;
    perlu_tinjauan: boolean;
    urutan_ke: number;
}

async function loadSubmission(q: Queryable, id: string): Promise<SubmissionResult | null> {
    const {rows} = await q.query(
        `select sub.id, sub.dikumpulkan_pada, sub.terlambat, sub.perlu_tinjauan,
                (select count(*)::int
                   from submissions s2
                  where s2.assignment_id = sub.assignment_id
                    and s2.student_id = sub.student_id) as urutan
           from submissions sub
          where sub.id = $1`,
        [id]
    );
    const row = rows[0];
    if (!row) {
        return null;
    }
    return {
        submission_id: row.id,
        dikumpulkan_pada: row.dikumpulkan_pada,
        terlambat: row.terlambat,
        perlu_tinjauan: row.perlu_tinjauan,
        urutan_ke: Number(row.urutan)
    };
}

/*
 * Membuat submission (tombol Kumpulkan). Mendukung:
 * - sumber dari `snapshot_id` (menyalin referensi objek snapshot)
 * - sumber biner `.sb3` langsung (membuat snapshot manual lebih dulu)
 * - pengumpulan berulang
 * - Idempotency-Key (request ulang mengembalikan hasil sebelumnya)
 * - menolak snapshot dengan isi yang sama yang sudah pernah dikumpulkan (409)
 *
 * `terlambat` dan `perlu_tinjauan` dihitung dari waktu database saat kejadian.
 */
export async function createSubmission(
    deps: Deps,
    input: CreateSubmissionInput
): Promise<SubmissionResult> {
    const {db} = deps;

    const assignment = await loadAssignmentForStudent(db, input.assignmentId, input.studentId);
    if (!assignment) {
        throw Errors.bukanAnggota();
    }

    const window = evaluateAssignmentWindow({
        sekarang: assignment.sekarang,
        dibukaPada: assignment.dibuka_pada,
        ditutupPada: assignment.ditutup_pada
    });
    if (window.status === 'belum_dibuka') {
        throw new ApiError(403, 'TUGAS_BELUM_DIBUKA', 'Tugas belum dibuka.');
    }

    const terlambat = window.status === 'ditutup';
    const perluTinjauan = terlambat && !assignment.izinkan_terlambat;

    let objectKey: string;
    let isiHash: string;
    let ukuran: number;

    if (input.snapshotId) {
        const {rows} = await db.query(
            `select assignment_id, student_id, object_key, isi_hash, ukuran_bytes
               from snapshots
              where id = $1`,
            [input.snapshotId]
        );
        const snap = rows[0];
        if (!snap || snap.student_id !== input.studentId || snap.assignment_id !== input.assignmentId) {
            throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.');
        }
        objectKey = snap.object_key;
        isiHash = snap.isi_hash;
        ukuran = Number(snap.ukuran_bytes);
    } else if (input.bytes) {
        if (input.bytes.length === 0) {
            throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Berkas kosong.');
        }
        const snap = await saveSnapshot(deps, {
            assignmentId: input.assignmentId,
            studentId: input.studentId,
            bytes: input.bytes,
            jenis: 'manual'
        });
        const {rows} = await db.query(
            'select object_key, isi_hash, ukuran_bytes from snapshots where id = $1',
            [snap.snapshot_id]
        );
        objectKey = rows[0].object_key;
        isiHash = rows[0].isi_hash;
        ukuran = Number(rows[0].ukuran_bytes);
    } else {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Sumber pengumpulan tidak diberikan.');
    }

    return withTransaction(db, async q => {
        // Serialisasi pengumpulan per murid+tugas untuk mencegah pengumpulan ganda.
        await q.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
            `submission:${input.assignmentId}:${input.studentId}`
        ]);

        if (input.idempotencyKey) {
            const prior = await q.query(
                'select resource_id from idempotency_keys where kode = $1 and scope = $2',
                [input.idempotencyKey, 'submission']
            );
            if (prior.rows[0]) {
                const existing = await loadSubmission(q, prior.rows[0].resource_id);
                if (existing) {
                    return existing;
                }
            }
        }

        const duplicate = await q.query(
            `select id from submissions
              where assignment_id = $1 and student_id = $2 and isi_hash = $3
              limit 1`,
            [input.assignmentId, input.studentId, isiHash]
        );
        if (duplicate.rows[0]) {
            throw new ApiError(409, 'SNAPSHOT_SUDAH_DIKUMPULKAN', 'Pengumpulan ini sudah pernah dilakukan.');
        }

        const count = await q.query(
            'select count(*)::int as n from submissions where assignment_id = $1 and student_id = $2',
            [input.assignmentId, input.studentId]
        );
        const urutanKe = Number(count.rows[0].n) + 1;

        const id = newId();
        const inserted = await q.query(
            `insert into submissions
               (id, assignment_id, class_id, student_id, terlambat, perlu_tinjauan,
                object_key, isi_hash, ukuran_bytes, catatan_siswa)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             returning id, dikumpulkan_pada`,
            [
                id,
                input.assignmentId,
                assignment.class_id,
                input.studentId,
                terlambat,
                perluTinjauan,
                objectKey,
                isiHash,
                ukuran,
                input.catatanSiswa ?? null
            ]
        );

        if (input.idempotencyKey) {
            await q.query(
                'insert into idempotency_keys (kode, scope, resource_id) values ($1, $2, $3)',
                [input.idempotencyKey, 'submission', id]
            );
        }

        return {
            submission_id: id,
            dikumpulkan_pada: inserted.rows[0].dikumpulkan_pada,
            terlambat,
            perlu_tinjauan: perluTinjauan,
            urutan_ke: urutanKe
        } satisfies SubmissionResult;
    });
}

export async function getSubmissionContent(
    deps: Deps,
    submissionId: string
): Promise<{bytes: Uint8Array; isi_hash: string}> {
    const {rows} = await deps.db.query('select object_key, isi_hash from submissions where id = $1', [
        submissionId
    ]);
    const row = rows[0];
    if (!row) {
        throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.');
    }
    const bytes = await deps.storage.get(row.object_key);
    return {bytes, isi_hash: row.isi_hash};
}
