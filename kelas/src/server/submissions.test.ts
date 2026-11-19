import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {saveSnapshot} from './snapshots';
import {createSubmission} from './submissions';
import {TEST_DATABASE_URL, caught, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const rand = (n: number) => new Uint8Array(randomBytes(n));

describe.skipIf(!enabled)('submissions — tepat waktu, terlambat, berulang, idempotensi', () => {
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

    const closeAssignment = (assignmentId: string) =>
        pool.query(`update assignments set ditutup_pada = now() - interval '1 second' where id = $1`, [
            assignmentId
        ]);

    const saveManual = (assignmentId: string, studentId: string, bytes: Uint8Array) =>
        saveSnapshot(deps, {assignmentId, studentId, bytes, jenis: 'manual'});

    it('pengumpulan tepat waktu', async () => {
        const seed = await seedAssignment(pool);
        const snap = await saveManual(seed.assignmentId, seed.studentId, rand(1200));

        const result = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id
        });

        expect(result.terlambat).toBe(false);
        expect(result.perlu_tinjauan).toBe(false);
        expect(result.urutan_ke).toBe(1);
    });

    it('pengumpulan berulang dengan snapshot baru menaikkan urutan', async () => {
        const seed = await seedAssignment(pool);
        const first = await saveManual(seed.assignmentId, seed.studentId, rand(1000));
        const second = await saveManual(seed.assignmentId, seed.studentId, rand(1001));

        const s1 = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: first.snapshot_id
        });
        const s2 = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: second.snapshot_id
        });

        expect(s1.urutan_ke).toBe(1);
        expect(s2.urutan_ke).toBe(2);
        expect(s2.submission_id).not.toBe(s1.submission_id);

        const count = await pool.query('select count(*)::int as n from submissions');
        expect(count.rows[0].n).toBe(2);
    });

    it('menolak snapshot yang sama dikumpulkan dua kali (409)', async () => {
        const seed = await seedAssignment(pool);
        const snap = await saveManual(seed.assignmentId, seed.studentId, rand(1400));

        await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id
        });

        const error = await caught(() =>
            createSubmission(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                snapshotId: snap.snapshot_id
            })
        );
        expect(error.status).toBe(409);
        expect(error.kode).toBe('SNAPSHOT_SUDAH_DIKUMPULKAN');
    });

    it('Idempotency-Key mengembalikan hasil yang sama', async () => {
        const seed = await seedAssignment(pool);
        const snap = await saveManual(seed.assignmentId, seed.studentId, rand(1500));

        const first = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id,
            idempotencyKey: 'kunci-abc'
        });
        const second = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id,
            idempotencyKey: 'kunci-abc'
        });

        expect(second.submission_id).toBe(first.submission_id);
        const count = await pool.query('select count(*)::int as n from submissions');
        expect(count.rows[0].n).toBe(1);
    });

    it('terlambat dengan izinkan_terlambat=true -> perlu_tinjauan=false', async () => {
        const seed = await seedAssignment(pool, {izinkanTerlambat: true});
        const snap = await saveManual(seed.assignmentId, seed.studentId, rand(1800));
        await closeAssignment(seed.assignmentId);

        const result = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id
        });

        expect(result.terlambat).toBe(true);
        expect(result.perlu_tinjauan).toBe(false);
    });

    it('terlambat dengan izinkan_terlambat=false -> perlu_tinjauan=true', async () => {
        const seed = await seedAssignment(pool, {izinkanTerlambat: false});
        const snap = await saveManual(seed.assignmentId, seed.studentId, rand(1900));
        await closeAssignment(seed.assignmentId);

        const result = await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: snap.snapshot_id
        });

        expect(result.terlambat).toBe(true);
        expect(result.perlu_tinjauan).toBe(true);
    });

    it('menolak pengumpulan sebelum tugas dibuka', async () => {
        const seed = await seedAssignment(pool, {bukaOffsetDetik: 3600, tutupOffsetDetik: 7200});
        const error = await caught(() =>
            createSubmission(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                snapshotId: '00000000-0000-0000-0000-000000000000'
            })
        );
        expect(error.status).toBe(403);
        expect(error.kode).toBe('TUGAS_BELUM_DIBUKA');
    });
});
