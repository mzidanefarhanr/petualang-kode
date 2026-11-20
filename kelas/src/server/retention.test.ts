import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {saveSnapshot} from './snapshots';
import {createSubmission} from './submissions';
import {runRetention} from './retention';
import {RETENSI_SNAPSHOT_NORMAL} from '../lib/config';
import {TEST_DATABASE_URL, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const rand = (n: number) => new Uint8Array(randomBytes(n));

describe.skipIf(!enabled)('retensi snapshot', () => {
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

    async function buatSnapshot(assignmentId: string, studentId: string, jumlah: number) {
        const ids: string[] = [];
        for (let i = 0; i < jumlah; i++) {
            const snap = await saveSnapshot(deps, {
                assignmentId,
                studentId,
                bytes: new Uint8Array([...rand(200), i % 256]),
                jenis: 'manual'
            });
            ids.push(snap.snapshot_id);
        }
        return ids;
    }

    const jumlahSnapshot = async (assignmentId: string, studentId: string) =>
        Number(
            (
                await pool.query(
                    'select count(*)::int as n from snapshots where assignment_id = $1 and student_id = $2',
                    [assignmentId, studentId]
                )
            ).rows[0].n
        );

    it('memangkas snapshot di atas batas menjadi 20', async () => {
        const seed = await seedAssignment(pool);
        await buatSnapshot(seed.assignmentId, seed.studentId, RETENSI_SNAPSHOT_NORMAL + 2);

        expect(await jumlahSnapshot(seed.assignmentId, seed.studentId)).toBe(RETENSI_SNAPSHOT_NORMAL + 2);

        const result = await runRetention(deps.db, deps.storage);
        expect(result.dihapus).toBe(2);
        expect(await jumlahSnapshot(seed.assignmentId, seed.studentId)).toBe(RETENSI_SNAPSHOT_NORMAL);

        // Idempoten: dijalankan lagi tidak menghapus apa pun.
        const second = await runRetention(deps.db, deps.storage);
        expect(second.dihapus).toBe(0);
    });

    it('melindungi snapshot yang pernah dikumpulkan', async () => {
        const seed = await seedAssignment(pool);
        const ids = await buatSnapshot(seed.assignmentId, seed.studentId, RETENSI_SNAPSHOT_NORMAL + 2);

        // Kumpulkan snapshot paling lama agar hash-nya dirujuk submission.
        const tertua = ids[0];
        await createSubmission(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            snapshotId: tertua
        });

        await runRetention(deps.db, deps.storage);

        const masihAda = await pool.query('select 1 from snapshots where id = $1', [tertua]);
        expect(masihAda.rowCount).toBe(1);

        // 22 snapshot, satu dilindungi -> tersisa 21.
        expect(await jumlahSnapshot(seed.assignmentId, seed.studentId)).toBe(RETENSI_SNAPSHOT_NORMAL + 1);
    });
});
