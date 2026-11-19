import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {sha256Hex} from '../lib/files';
import {getLastProject, getSnapshotContent, saveSnapshot} from './snapshots';
import {TEST_DATABASE_URL, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);

describe.skipIf(!enabled)('Gerbang 1 — integritas berkas .sb3', () => {
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

    it('hash SHA-256 sebelum unggah sama dengan sesudah unduh', async () => {
        const seed = await seedAssignment(pool);
        // Byte tiruan `.sb3` (arsip ZIP). Server tidak boleh mengubahnya.
        const bytes = new Uint8Array(randomBytes(4096));
        const before = sha256Hex(bytes);

        const snapshot = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes,
            jenis: 'manual'
        });

        const project = await getLastProject(deps, seed.assignmentId, seed.studentId);
        expect(project).not.toBeNull();
        expect(project!.bytes.length).toBe(bytes.length);
        expect(sha256Hex(project!.bytes)).toBe(before);
        expect(project!.snapshot_id).toBe(snapshot.snapshot_id);

        const content = await getSnapshotContent(deps, snapshot.snapshot_id);
        expect(content.bytes.length).toBe(bytes.length);
        expect(sha256Hex(content.bytes)).toBe(before);
    });

    it('belum ada proyek menghasilkan null', async () => {
        const seed = await seedAssignment(pool);
        await expect(getLastProject(deps, seed.assignmentId, seed.studentId)).resolves.toBeNull();
    });
});
