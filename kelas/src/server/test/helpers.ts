import {Pool} from 'pg';
import {MemoryStorage} from '../../lib/storage';
import {ApiError} from '../../lib/http/errors';
import type {Deps} from '../deps';

/*
 * Utilitas bersama untuk integration test (Vitest).
 *
 * Integration test hanya berjalan bila TEST_DATABASE_URL tersedia. Gunakan
 * database pengujian terpisah, bukan database pengembangan.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export async function caught(fn: () => Promise<unknown>): Promise<ApiError> {
    try {
        await fn();
    } catch (error) {
        if (error instanceof ApiError) {
            return error;
        }
        throw error;
    }
    throw new Error('Diharapkan ApiError, tetapi tidak ada error yang dilempar.');
}

export function makeDeps(): {deps: Deps; pool: Pool; storage: MemoryStorage} {
    const pool = new Pool({connectionString: TEST_DATABASE_URL});
    const storage = new MemoryStorage();
    return {deps: {db: pool, storage}, pool, storage};
}

export async function resetDb(pool: Pool): Promise<void> {
    await pool.query(
        `truncate table
           idempotency_keys,
           comments,
           save_intents,
           submissions,
           snapshots,
           assignments,
           invites,
           class_members,
           classes,
           schools,
           students,
           teachers
         restart identity cascade`
    );
}

export interface SeedOptions {
    // offset waktu dalam detik relatif terhadap now() (positif = masa depan)
    bukaOffsetDetik?: number;
    tutupOffsetDetik?: number;
    izinkanTerlambat?: boolean;
}

export interface SeedResult {
    teacherId: string;
    classId: string;
    studentId: string;
    assignmentId: string;
}

export async function seedAssignment(pool: Pool, options: SeedOptions = {}): Promise<SeedResult> {
    const {bukaOffsetDetik = -3600, tutupOffsetDetik = 3600, izinkanTerlambat = true} = options;

    const teacher = (
        await pool.query(
            `insert into teachers (email, password_hash, nama)
             values ('guru.uji@example.test', 'x', 'Guru Uji')
             returning id`
        )
    ).rows[0].id;

    const classId = (
        await pool.query(`insert into classes (teacher_id, nama) values ($1, 'Kelas Uji') returning id`, [
            teacher
        ])
    ).rows[0].id;

    const student = (
        await pool.query(
            `insert into students (username, nama, password_hash)
             values ('murid.uji', 'Murid Uji', 'x')
             returning id`
        )
    ).rows[0].id;

    await pool.query('insert into class_members (class_id, student_id) values ($1, $2)', [
        classId,
        student
    ]);

    const assignment = (
        await pool.query(
            `insert into assignments (class_id, judul, dibuka_pada, ditutup_pada, izinkan_terlambat)
             values ($1, 'Tugas Uji', now() + ($2 || ' seconds')::interval,
                     now() + ($3 || ' seconds')::interval, $4)
             returning id`,
            [classId, String(bukaOffsetDetik), String(tutupOffsetDetik), izinkanTerlambat]
        )
    ).rows[0].id;

    return {teacherId: teacher, classId, studentId: student, assignmentId: assignment};
}
