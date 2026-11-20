import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {listSubmissionsForTeacher, updateAssignment} from './assignments';
import {saveSnapshot} from './snapshots';
import {createSubmission} from './submissions';
import {TEST_DATABASE_URL, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const rand = (n: number) => new Uint8Array(randomBytes(n));

describe.skipIf(!enabled)('daftar nilai guru dan perubahan jendela waktu', () => {
    let pool: Pool;
    let deps: Deps;

    beforeAll(() => {
        const made = makeDeps();
        pool = made.pool;
        deps = made.deps;
    });

    afterAll(async () => {
        await pool.end();
    });

    beforeEach(async () => {
        await resetDb(pool);
    });

    async function addStudent(classId: string, username: string, nama: string): Promise<string> {
        const student = await pool.query(
            `insert into students (username, nama, password_hash) values ($1, $2, 'x') returning id`,
            [username, nama]
        );
        await pool.query('insert into class_members (class_id, student_id) values ($1, $2)', [
            classId,
            student.rows[0].id
        ]);
        return student.rows[0].id;
    }

    it('menampilkan semua anggota kelas termasuk yang belum mengumpulkan', async () => {
        const seed = await seedAssignment(pool);
        await addStudent(seed.classId, 'murid.belum', 'Belum Kumpul');

        const snap = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1000),
            jenis: 'manual'
        });
        await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id
        });

        const data = await listSubmissionsForTeacher(deps.db, seed.assignmentId);
        expect(data.murid.length).toBe(2);

        const belum = data.murid.find(row => row.nama === 'Belum Kumpul')!;
        expect(belum.belum_kumpul).toBe(true);
        expect(belum.jumlah_kumpul).toBe(0);

        const sudah = data.murid.find(row => row.nama === 'Murid Uji')!;
        expect(sudah.belum_kumpul).toBe(false);
        expect(sudah.jumlah_kumpul).toBe(1);
    });

    it('mengubah ditutup_pada tidak mengubah terlambat submission lama', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: 3600});
        const snap = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1400),
            jenis: 'manual'
        });
        const submission = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id
        });
        expect(submission.terlambat).toBe(false);

        // Tutup tugas di masa lalu; submission lama harus tetap terlambat=false.
        await updateAssignment(deps.db, seed.assignmentId, {
            ditutupPada: new Date(Date.now() - 60_000)
        });

        const after = await pool.query('select terlambat, perlu_tinjauan from submissions where id = $1', [
            submission.submission_id
        ]);
        expect(after.rows[0].terlambat).toBe(false);
        expect(after.rows[0].perlu_tinjauan).toBe(false);
    });
});
