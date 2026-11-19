import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {sha256Hex} from '../lib/files';
import {createSaveIntent, saveSnapshot} from './snapshots';
import {TEST_DATABASE_URL, caught, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const rand = (n: number) => new Uint8Array(randomBytes(n));

describe.skipIf(!enabled)('save intent — tenggat dan penyimpanan akhir', () => {
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

    const extendIntent = (saveIntentId: string) =>
        pool.query(
            `update save_intents set berlaku_sampai = now() + interval '30 seconds' where id = $1`,
            [saveIntentId]
        );

    it('dapat dibuat sebelum tenggat', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: 3600});
        const bytes = rand(1500);
        const intent = await createSaveIntent(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            isiHash: sha256Hex(bytes),
            ukuran: bytes.length
        });
        expect(intent.upload_token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(intent.maks_penggunaan).toBe(1);

        const row = await pool.query('select token_hash from save_intents where id = $1', [intent.save_intent_id]);
        expect(row.rows[0].token_hash).not.toBe(intent.upload_token);
    });

    it('ditolak setelah tenggat', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: -60});
        const bytes = rand(1200);
        const error = await caught(() =>
            createSaveIntent(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                isiHash: sha256Hex(bytes),
                ukuran: bytes.length
            })
        );
        expect(error.status).toBe(403);
        expect(error.kode).toBe('TUGAS_DITUTUP');
    });

    it('menolak simpan biasa setelah tenggat tanpa intent', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: -60});
        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: rand(800),
                jenis: 'manual'
            })
        );
        expect(error.status).toBe(403);
        expect(error.kode).toBe('TUGAS_DITUTUP');
    });

    it('unggahan akhir dengan intent valid diterima setelah tenggat', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: 3600});
        const bytes = rand(2000);
        const intent = await createSaveIntent(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            isiHash: sha256Hex(bytes),
            ukuran: bytes.length
        });

        await closeAssignment(seed.assignmentId);
        await extendIntent(intent.save_intent_id);

        const snapshot = await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes,
            jenis: 'manual',
            saveIntentToken: intent.upload_token
        });

        expect(snapshot.penyimpanan_akhir).toBe(true);
        expect(snapshot.baru).toBe(true);
        expect(snapshot.terlambat).toBe(false);
    });

    it('menolak hash yang tidak sesuai dengan intent', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: 3600});
        const bytesA = rand(1000);
        const bytesB = rand(1001);
        const intent = await createSaveIntent(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            isiHash: sha256Hex(bytesA),
            ukuran: bytesA.length
        });

        await closeAssignment(seed.assignmentId);
        await extendIntent(intent.save_intent_id);

        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: bytesB,
                jenis: 'manual',
                saveIntentToken: intent.upload_token
            })
        );
        expect(error.status).toBe(422);
        expect(error.kode).toBe('HASH_TIDAK_SESUAI');
    });

    it('menolak intent yang dipakai dua kali', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: 3600});
        const bytes = rand(1600);
        const intent = await createSaveIntent(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            isiHash: sha256Hex(bytes),
            ukuran: bytes.length
        });

        await closeAssignment(seed.assignmentId);
        await extendIntent(intent.save_intent_id);

        await saveSnapshot(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            bytes,
            jenis: 'manual',
            saveIntentToken: intent.upload_token
        });

        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: rand(1700),
                jenis: 'manual',
                saveIntentToken: intent.upload_token
            })
        );
        expect(error.status).toBe(409);
        expect(error.kode).toBe('SAVE_INTENT_SUDAH_DIPAKAI');
    });

    it('menolak intent yang kedaluwarsa', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: 3600});
        const bytes = rand(1300);
        const intent = await createSaveIntent(deps, {
            assignmentId: seed.assignmentId,
            studentId: seed.studentId,
            isiHash: sha256Hex(bytes),
            ukuran: bytes.length
        });

        await closeAssignment(seed.assignmentId);
        await pool.query(
            `update save_intents
                set dibuat_pada = now() - interval '120 seconds',
                    berlaku_sampai = now() - interval '60 seconds'
              where id = $1`,
            [intent.save_intent_id]
        );

        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes,
                jenis: 'manual',
                saveIntentToken: intent.upload_token
            })
        );
        expect(error.status).toBe(410);
        expect(error.kode).toBe('SAVE_INTENT_KEDALUWARSA');
    });

    it('menolak token yang tidak dikenal', async () => {
        const seed = await seedAssignment(pool, {tutupOffsetDetik: -60});
        const error = await caught(() =>
            saveSnapshot(deps, {
                assignmentId: seed.assignmentId,
                studentId: seed.studentId,
                bytes: rand(900),
                jenis: 'manual',
                saveIntentToken: 'token-palsu'
            })
        );
        expect(error.status).toBe(403);
        expect(error.kode).toBe('SAVE_INTENT_TIDAK_VALID');
    });
});
