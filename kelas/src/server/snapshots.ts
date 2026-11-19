import {randomBytes} from 'node:crypto';
import {ApiError, Errors} from '../lib/http/errors';
import {evaluateAssignmentWindow} from '../lib/assignment-window';
import {loadAssignmentForStudent, type AssignmentRow} from '../lib/assignment';
import {withTransaction, type Queryable} from '../lib/db';
import {AUTOSAVE_MIN_INTERVAL_SECONDS, MAX_SB3_SIZE_BYTES, SAVE_INTENT_TOLERANCE_SECONDS} from '../lib/config';
import {HASH_RE, newId, sha256Hex, sha256HexText, snapshotKey} from '../lib/files';
import type {Deps} from './deps';

export type JenisSimpan = 'otomatis' | 'manual';

export interface SaveSnapshotInput {
    assignmentId: string;
    studentId: string;
    bytes: Uint8Array;
    jenis: JenisSimpan;
    saveIntentToken?: string | null;
}

export interface SnapshotResult {
    snapshot_id: string;
    diambil_pada: Date;
    isi_hash: string;
    ukuran_bytes: number;
    baru: boolean;
    terlambat: boolean;
    penyimpanan_akhir?: boolean;
}

export interface SaveIntentResult {
    save_intent_id: string;
    upload_token: string;
    berlaku_sampai: Date;
    maks_penggunaan: number;
}

const isUniqueViolation = (error: unknown, constraint?: string): boolean => {
    const err = error as {code?: string; constraint?: string};
    return err?.code === '23505' && (!constraint || err.constraint === constraint);
};

async function findSnapshotByHash(
    db: Queryable,
    assignmentId: string,
    studentId: string,
    isiHash: string
): Promise<{id: string; diambil_pada: Date; isi_hash: string; ukuran_bytes: string} | null> {
    const {rows} = await db.query(
        `select id, diambil_pada, isi_hash, ukuran_bytes
           from snapshots
          where assignment_id = $1 and student_id = $2 and isi_hash = $3`,
        [assignmentId, studentId, isiHash]
    );
    return rows[0] ?? null;
}

async function latestAutoSnapshot(
    db: Queryable,
    assignmentId: string,
    studentId: string
): Promise<{diambil_pada: Date} | null> {
    const {rows} = await db.query(
        `select diambil_pada
           from snapshots
          where assignment_id = $1 and student_id = $2 and jenis_simpan = 'otomatis'
          order by diambil_pada desc, id desc
          limit 1`,
        [assignmentId, studentId]
    );
    return rows[0] ?? null;
}

async function insertSnapshotRow(
    db: Queryable,
    args: {
        id: string;
        assignment: AssignmentRow;
        studentId: string;
        jenis: JenisSimpan;
        objectKey: string;
        isiHash: string;
        ukuran: number;
    }
): Promise<{id: string; diambil_pada: Date}> {
    const {rows} = await db.query(
        `insert into snapshots
           (id, assignment_id, class_id, student_id, jenis_simpan, object_key, isi_hash, ukuran_bytes)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id, diambil_pada`,
        [
            args.id,
            args.assignment.id,
            args.assignment.class_id,
            args.studentId,
            args.jenis,
            args.objectKey,
            args.isiHash,
            args.ukuran
        ]
    );
    return rows[0];
}

/*
 * Menyimpan snapshot. Menangani:
 * - jendela waktu (belum dibuka / dibuka / ditutup)
 * - dedup berdasarkan (assignment_id, student_id, isi_hash)
 * - rate limit autosave 20 detik
 * - unggahan akhir via save intent setelah tenggat (atomik)
 */
export async function saveSnapshot(deps: Deps, input: SaveSnapshotInput): Promise<SnapshotResult> {
    const {db, storage} = deps;

    if (input.bytes.length === 0) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Berkas kosong.');
    }
    if (input.bytes.length > MAX_SB3_SIZE_BYTES) {
        throw new ApiError(413, 'ARSIP_TERLALU_BESAR', 'Ukuran berkas melebihi batas.');
    }

    const assignment = await loadAssignmentForStudent(db, input.assignmentId, input.studentId);
    if (!assignment) {
        throw Errors.bukanAnggota();
    }

    const isiHash = sha256Hex(input.bytes);
    const ukuran = input.bytes.length;
    const window = evaluateAssignmentWindow({
        sekarang: assignment.sekarang,
        dibukaPada: assignment.dibuka_pada,
        ditutupPada: assignment.ditutup_pada
    });

    if (window.status === 'belum_dibuka') {
        throw new ApiError(403, 'TUGAS_BELUM_DIBUKA', 'Tugas belum dibuka.');
    }

    if (window.status === 'ditutup') {
        if (!input.saveIntentToken) {
            throw new ApiError(403, 'TUGAS_DITUTUP', 'Tugas sudah ditutup. Editor sekarang hanya dapat dibaca.');
        }
        return consumeSaveIntent(deps, {
            assignment,
            studentId: input.studentId,
            bytes: input.bytes,
            isiHash,
            ukuran,
            token: input.saveIntentToken
        });
    }

    // Masih dalam jendela waktu.
    const existing = await findSnapshotByHash(db, input.assignmentId, input.studentId, isiHash);
    if (existing) {
        return {
            snapshot_id: existing.id,
            diambil_pada: existing.diambil_pada,
            isi_hash: isiHash,
            ukuran_bytes: Number(existing.ukuran_bytes),
            baru: false,
            terlambat: false
        };
    }

    if (input.jenis === 'otomatis') {
        const last = await latestAutoSnapshot(db, input.assignmentId, input.studentId);
        if (
            last &&
            assignment.sekarang.getTime() - last.diambil_pada.getTime() <
                AUTOSAVE_MIN_INTERVAL_SECONDS * 1000
        ) {
            throw new ApiError(429, 'TERLALU_SERING', 'Terlalu sering menyimpan. Coba lagi sebentar lagi.', {
                retry_after: AUTOSAVE_MIN_INTERVAL_SECONDS
            });
        }
    }

    const id = newId();
    const key = snapshotKey(input.assignmentId, input.studentId, id);
    await storage.put(key, input.bytes);

    try {
        const row = await insertSnapshotRow(db, {
            id,
            assignment,
            studentId: input.studentId,
            jenis: input.jenis,
            objectKey: key,
            isiHash,
            ukuran
        });
        return {
            snapshot_id: row.id,
            diambil_pada: row.diambil_pada,
            isi_hash: isiHash,
            ukuran_bytes: ukuran,
            baru: true,
            terlambat: false
        };
    } catch (error) {
        if (isUniqueViolation(error, 'snapshots_assignment_student_hash_unique')) {
            const raced = await findSnapshotByHash(db, input.assignmentId, input.studentId, isiHash);
            if (raced) {
                return {
                    snapshot_id: raced.id,
                    diambil_pada: raced.diambil_pada,
                    isi_hash: isiHash,
                    ukuran_bytes: Number(raced.ukuran_bytes),
                    baru: false,
                    terlambat: false
                };
            }
        }
        throw error;
    }
}

async function consumeSaveIntent(
    deps: Deps,
    args: {
        assignment: AssignmentRow;
        studentId: string;
        bytes: Uint8Array;
        isiHash: string;
        ukuran: number;
        token: string;
    }
): Promise<SnapshotResult> {
    const {db, storage} = deps;
    const tokenHash = sha256HexText(args.token);

    // Siapkan objek lebih dulu agar transaksi hanya menyentuh database.
    const id = newId();
    const key = snapshotKey(args.assignment.id, args.studentId, id);
    await storage.put(key, args.bytes);

    const result = await withTransaction(db, async queryable => {
        const claim = await queryable.query(
            `update save_intents
                set dipakai_pada = now()
              where token_hash = $1
                and assignment_id = $2
                and student_id = $3
                and isi_hash = $4
                and ukuran_bytes = $5
                and dipakai_pada is null
                and berlaku_sampai > now()
              returning id`,
            [tokenHash, args.assignment.id, args.studentId, args.isiHash, args.ukuran]
        );

        if (claim.rowCount !== 1) {
            return null;
        }

        const row = await insertSnapshotRow(queryable, {
            id,
            assignment: args.assignment,
            studentId: args.studentId,
            jenis: 'manual',
            objectKey: key,
            isiHash: args.isiHash,
            ukuran: args.ukuran
        });

        return {
            snapshot_id: row.id,
            diambil_pada: row.diambil_pada,
            isi_hash: args.isiHash,
            ukuran_bytes: args.ukuran,
            baru: true,
            terlambat: false,
            penyimpanan_akhir: true
        } satisfies SnapshotResult;
    });

    if (result) {
        return result;
    }

    // Klaim gagal: klasifikasikan penyebabnya.
    const {rows} = await db.query(
        `select assignment_id, student_id, isi_hash, ukuran_bytes, dipakai_pada, berlaku_sampai, now() as sekarang
           from save_intents
          where token_hash = $1`,
        [tokenHash]
    );
    const intent = rows[0];
    if (!intent || intent.assignment_id !== args.assignment.id || intent.student_id !== args.studentId) {
        throw new ApiError(403, 'SAVE_INTENT_TIDAK_VALID', 'Izin penyimpanan tidak valid.');
    }
    if (intent.dipakai_pada) {
        throw new ApiError(409, 'SAVE_INTENT_SUDAH_DIPAKAI', 'Izin penyimpanan sudah digunakan.');
    }
    if (new Date(intent.berlaku_sampai).getTime() <= new Date(intent.sekarang).getTime()) {
        throw new ApiError(410, 'SAVE_INTENT_KEDALUWARSA', 'Izin penyimpanan sudah kedaluwarsa.');
    }
    if (intent.isi_hash !== args.isiHash || Number(intent.ukuran_bytes) !== args.ukuran) {
        throw new ApiError(422, 'HASH_TIDAK_SESUAI', 'Isi berkas tidak sesuai dengan izin penyimpanan.');
    }
    throw new ApiError(403, 'SAVE_INTENT_TIDAK_VALID', 'Izin penyimpanan tidak valid.');
}

export async function createSaveIntent(
    deps: Deps,
    input: {assignmentId: string; studentId: string; isiHash: string; ukuran: number}
): Promise<SaveIntentResult> {
    if (!HASH_RE.test(input.isiHash)) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'isi_hash tidak valid.');
    }
    if (!Number.isInteger(input.ukuran) || input.ukuran <= 0 || input.ukuran > MAX_SB3_SIZE_BYTES) {
        throw new ApiError(413, 'ARSIP_TERLALU_BESAR', 'Ukuran berkas tidak valid atau melebihi batas.');
    }

    const assignment = await loadAssignmentForStudent(deps.db, input.assignmentId, input.studentId);
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
    if (window.status === 'ditutup') {
        throw new ApiError(403, 'TUGAS_DITUTUP', 'Tugas sudah ditutup.');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256HexText(token);
    const berlakuSampai = new Date(
        assignment.ditutup_pada.getTime() + SAVE_INTENT_TOLERANCE_SECONDS * 1000
    );

    const {rows} = await deps.db.query(
        `insert into save_intents
           (assignment_id, class_id, student_id, token_hash, isi_hash, ukuran_bytes, berlaku_sampai)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id`,
        [
            assignment.id,
            assignment.class_id,
            input.studentId,
            tokenHash,
            input.isiHash,
            input.ukuran,
            berlakuSampai
        ]
    );

    return {
        save_intent_id: rows[0].id,
        upload_token: token,
        berlaku_sampai: berlakuSampai,
        maks_penggunaan: 1
    };
}

export interface SnapshotListItem {
    id: string;
    diambil_pada: Date;
    ukuran_bytes: number;
    isi_hash: string;
}

export async function listSnapshots(
    deps: Deps,
    assignmentId: string,
    studentId: string
): Promise<SnapshotListItem[]> {
    const {rows} = await deps.db.query(
        `select id, diambil_pada, ukuran_bytes, isi_hash
           from snapshots
          where assignment_id = $1 and student_id = $2
          order by diambil_pada desc, id desc`,
        [assignmentId, studentId]
    );
    return rows.map(row => ({
        id: row.id,
        diambil_pada: row.diambil_pada,
        ukuran_bytes: Number(row.ukuran_bytes),
        isi_hash: row.isi_hash
    }));
}

export interface ProjectContent {
    bytes: Uint8Array;
    snapshot_id: string;
    diambil_pada: Date;
    ukuran_bytes: number;
    isi_hash: string;
}

export async function getLastProject(
    deps: Deps,
    assignmentId: string,
    studentId: string
): Promise<ProjectContent | null> {
    const {rows} = await deps.db.query(
        `select id, diambil_pada, ukuran_bytes, isi_hash, object_key
           from snapshots
          where assignment_id = $1 and student_id = $2
          order by diambil_pada desc, id desc
          limit 1`,
        [assignmentId, studentId]
    );
    const row = rows[0];
    if (!row) {
        return null;
    }
    const bytes = await deps.storage.get(row.object_key);
    return {
        bytes,
        snapshot_id: row.id,
        diambil_pada: row.diambil_pada,
        ukuran_bytes: Number(row.ukuran_bytes),
        isi_hash: row.isi_hash
    };
}

export async function getSnapshotContent(
    deps: Deps,
    snapshotId: string
): Promise<{bytes: Uint8Array; isi_hash: string}> {
    const {rows} = await deps.db.query(
        'select object_key, isi_hash from snapshots where id = $1',
        [snapshotId]
    );
    const row = rows[0];
    if (!row) {
        throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Data tidak ditemukan.');
    }
    const bytes = await deps.storage.get(row.object_key);
    return {bytes, isi_hash: row.isi_hash};
}
