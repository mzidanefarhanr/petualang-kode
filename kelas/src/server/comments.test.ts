import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {requireAccess} from '../lib/access';
import {createComment, listComments} from './comments';
import {saveSnapshot} from './snapshots';
import {createSubmission} from './submissions';
import {TEST_DATABASE_URL, caught, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const rand = (n: number) => new Uint8Array(randomBytes(n));

describe.skipIf(!enabled)('komentar', () => {
    let pool: Pool;
    let deps: Deps;
    let submissionId: string;
    let session: Awaited<ReturnType<typeof seedAssignment>>;

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
        session = await seedAssignment(pool);
        const snap = await saveSnapshot(deps, {
            assignmentId: session.assignmentId,
            studentId: session.studentId,
            bytes: rand(900),
            jenis: 'manual'
        });
        const submission = await createSubmission(deps, {
            assignmentId: session.assignmentId,
            studentId: session.studentId,
            snapshotId: snap.snapshot_id
        });
        submissionId = submission.submission_id;
    });

    it('guru pemilik kelas dapat berkomentar', async () => {
        const created = await createComment(deps.db, {
            submissionId,
            role: 'guru',
            userId: session.teacherId,
            isi: 'Bagus sekali.'
        });
        const komentar = await listComments(deps.db, submissionId);
        expect(komentar.length).toBe(1);
        expect(komentar[0].penulis.jenis).toBe('guru');
    });

    it('murid pemilik dapat berkomentar', async () => {
        await createComment(deps.db, {
            submissionId,
            role: 'murid',
            userId: session.studentId,
            isi: 'Terima kasih.'
        });
        const komentar = await listComments(deps.db, submissionId);
        expect(komentar[0].penulis.jenis).toBe('murid');
    });

    it('murid lain ditolak 404 saat mengakses submission', async () => {
        const other = await pool.query(
            `insert into students (username, nama, password_hash) values ('murid.lain','Lain','x') returning id`
        );
        const error = await caught(() =>
            requireAccess(
                deps.db,
                {user: {id: other.rows[0].id, role: 'murid'}},
                {role: 'murid', submissionId}
            )
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });

    it('menolak komentar kosong', async () => {
        const error = await caught(() =>
            createComment(deps.db, {submissionId, role: 'guru', userId: session.teacherId, isi: '   '})
        );
        expect(error.status).toBe(400);
        expect(error.kode).toBe('PERMINTAAN_TIDAK_VALID');
    });

    it('menolak komentar lebih dari 2000 karakter', async () => {
        const error = await caught(() =>
            createComment(deps.db, {
                submissionId,
                role: 'guru',
                userId: session.teacherId,
                isi: 'a'.repeat(2001)
            })
        );
        expect(error.status).toBe(400);
    });
});
