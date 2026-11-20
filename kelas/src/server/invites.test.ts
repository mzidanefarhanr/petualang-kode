import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createInvite, getInviteInfo, joinViaInvite, revokeInvite} from './invites';
import {TEST_DATABASE_URL, caught, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);
const future = () => new Date(Date.now() + 3600_000);

describe.skipIf(!enabled)('undangan dan pendaftaran murid', () => {
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

    it('murid dapat bergabung lewat undangan berlaku', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });

        const result = await joinViaInvite(deps.db, {
            kode: invite.kode,
            nama: 'Rani',
            username: 'rani',
            password: 'rahasia123'
        });
        expect(result.student.username).toBe('rani');

        const member = await pool.query(
            'select 1 from class_members where class_id = $1 and student_id = $2',
            [seed.classId, result.student.id]
        );
        expect(member.rowCount).toBe(1);

        const updated = await pool.query('select dipakai from invites where id = $1', [invite.id]);
        expect(updated.rows[0].dipakai).toBe(1);
    });

    it('undangan kedaluwarsa ditolak 410', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });
        await pool.query(
            `update invites set berlaku_dari = now() - interval '120 seconds',
                    berlaku_sampai = now() - interval '60 seconds' where id = $1`,
            [invite.id]
        );

        const error = await caught(() =>
            joinViaInvite(deps.db, {kode: invite.kode, nama: 'Rani', username: 'rani', password: 'rahasia123'})
        );
        expect(error.status).toBe(410);
        expect(error.kode).toBe('UNDANGAN_KEDALUWARSA');
    });

    it('undangan dicabut ditolak 410', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });
        await revokeInvite(deps.db, invite.id);

        const error = await caught(() =>
            joinViaInvite(deps.db, {kode: invite.kode, nama: 'Rani', username: 'rani', password: 'rahasia123'})
        );
        expect(error.status).toBe(410);
        expect(error.kode).toBe('UNDANGAN_DICABUT');
    });

    it('pencabutan tidak menghapus anggota lama', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });
        const joined = await joinViaInvite(deps.db, {
            kode: invite.kode,
            nama: 'Rani',
            username: 'rani',
            password: 'rahasia123'
        });
        await revokeInvite(deps.db, invite.id);

        const member = await pool.query(
            'select 1 from class_members where class_id = $1 and student_id = $2',
            [seed.classId, joined.student.id]
        );
        expect(member.rowCount).toBe(1);
    });

    it('batas pemakaian tidak terlewati oleh permintaan bersamaan', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: 1
        });

        const results = await Promise.allSettled([
            joinViaInvite(deps.db, {kode: invite.kode, nama: 'A', username: 'murid.a', password: 'rahasia123'}),
            joinViaInvite(deps.db, {kode: invite.kode, nama: 'B', username: 'murid.b', password: 'rahasia123'})
        ]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');
        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);

        const dipakai = await pool.query('select dipakai from invites where id = $1', [invite.id]);
        expect(dipakai.rows[0].dipakai).toBe(1);
    });

    it('username yang sudah dipakai ditolak 409', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });
        await joinViaInvite(deps.db, {kode: invite.kode, nama: 'Rani', username: 'rani', password: 'rahasia123'});

        const error = await caught(() =>
            joinViaInvite(deps.db, {kode: invite.kode, nama: 'Rani lain', username: 'RANI', password: 'rahasia123'})
        );
        expect(error.status).toBe(409);
        expect(error.kode).toBe('USERNAME_SUDAH_DIPAKAI');
    });

    it('kelas penuh ditolak 409', async () => {
        const seed = await seedAssignment(pool);
        // Kelas sudah punya 1 anggota dari seed; tambah 59 agar total 60.
        for (let i = 0; i < 59; i++) {
            const student = await pool.query(
                `insert into students (username, nama, password_hash) values ($1, $2, 'x') returning id`,
                [`isi.${i}`, `Isi ${i}`]
            );
            await pool.query('insert into class_members (class_id, student_id) values ($1, $2)', [
                seed.classId,
                student.rows[0].id
            ]);
        }

        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });
        const error = await caught(() =>
            joinViaInvite(deps.db, {kode: invite.kode, nama: 'Rani', username: 'rani', password: 'rahasia123'})
        );
        expect(error.status).toBe(409);
        expect(error.kode).toBe('KELAS_PENUH');
    });

    it('info undangan mengembalikan status', async () => {
        const seed = await seedAssignment(pool);
        const invite = await createInvite(deps.db, {
            classId: seed.classId,
            teacherId: seed.teacherId,
            berlakuSampai: future(),
            maksPemakaian: null
        });
        const info = await getInviteInfo(deps.db, invite.kode);
        expect(info.status).toBe('berlaku');
        expect(info.kelas.id).toBe(seed.classId);
    });
});
