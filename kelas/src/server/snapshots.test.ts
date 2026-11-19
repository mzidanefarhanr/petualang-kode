import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {listSnapshots, saveSnapshot} from './snapshots';
import {TEST_DATABASE_URL, caught, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const rand = (n: number) => new Uint8Array(randomBytes(n));

describe.skipIf(!enabled)('snapshots — dedup, rate limit, jendela waktu', () => {
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

    it('isi sama tidak membuat snapshot baru (dedup)', async () => {
        const seed = await seedAssignment(pool);
        const bytes = rand(2048);

        const first = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes,
            jenis: 'manual'
        });
        const second = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes,
            jenis: 'manual'
        });

        expect(first.baru).toBe(true);
        expect(second.baru).toBe(false);
        expect(second.snapshot_id).toBe(first.snapshot_id);

        const count = await pool.query('select count(*)::int as n from snapshots');
        expect(count.rows[0].n).toBe(1);
    });

    it('isi berbeda membuat snapshot baru', async () => {
        const seed = await seedAssignment(pool);
        const first = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1024),
            jenis: 'manual'
        });
        const second = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1025),
            jenis: 'manual'
        });
        expect(second.baru).toBe(true);
        expect(second.snapshot_id).not.toBe(first.snapshot_id);
    });

    it('rate limit 20 detik untuk snapshot otomatis', async () => {
        const seed = await seedAssignment(pool);
        await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1000),
            jenis: 'otomatis'
        });
        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: rand(1001),
                jenis: 'otomatis'
            })
        );
        expect(error.status).toBe(429);
        expect(error.kode).toBe('TERLALU_SERING');
    });

    it('simpan manual tidak diblokir rate limit', async () => {
        const seed = await seedAssignment(pool);
        await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1000),
            jenis: 'otomatis'
        });
        const manual = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(1001),
            jenis: 'manual'
        });
        expect(manual.baru).toBe(true);
    });

    it('menolak simpan sebelum waktu buka', async () => {
        const seed = await seedAssignment(pool, {bukaOffsetDetik: 3600, tutupOffsetDetik: 7200});
        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: rand(500),
                jenis: 'manual'
            })
        );
        expect(error.status).toBe(403);
        expect(error.kode).toBe('TUGAS_BELUM_DIBUKA');
    });

    it('menolak berkas melebihi batas ukuran', async () => {
        const seed = await seedAssignment(pool);
        const tooBig = new Uint8Array(50 * 1024 * 1024 + 1);
        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: tooBig,
                jenis: 'manual'
            })
        );
        expect(error.status).toBe(413);
        expect(error.kode).toBe('ARSIP_TERLALU_BESAR');
    });

    it('daftar snapshot tidak menyertakan object_key', async () => {
        const seed = await seedAssignment(pool);
        await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes: rand(300),
            jenis: 'manual'
        });
        const list = await listSnapshots(deps, seed.assignmentId, seed.studentId);
        expect(list.length).toBe(1);
        expect(Object.keys(list[0])).not.toContain('object_key');
    });
});
