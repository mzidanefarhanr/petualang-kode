import type {Pool} from 'pg';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {requireAccess} from '../lib/access';
import {createClass, listClasses} from './classes';
import {createSchool, listSchools} from './schools';
import {TEST_DATABASE_URL, caught, makeDeps, resetDb, seedAssignment} from './test/helpers';
import type {Deps} from './deps';

const enabled = Boolean(TEST_DATABASE_URL);

describe.skipIf(!enabled)('sekolah dan kelas guru', () => {
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

    it('guru dapat membuat dan melihat sekolah', async () => {
        const seed = await seedAssignment(pool);
        const school = await createSchool(deps.db, seed.teacherId, {nama: 'SDN 01'});
        expect(school.nama).toBe('SDN 01');

        const list = await listSchools(deps.db, seed.teacherId);
        expect(list.length).toBe(1);
    });

    it('guru dapat membuat kelas dengan sekolah miliknya', async () => {
        const seed = await seedAssignment(pool);
        const school = await createSchool(deps.db, seed.teacherId, {nama: 'SDN 01'});
        const created = await createClass(deps.db, seed.teacherId, {nama: 'Kelas 6B', schoolId: school.id});
        expect(created.school_id).toBe(school.id);

        const list = await listClasses(deps.db, seed.teacherId);
        expect(list.some(row => row.id === created.id)).toBe(true);
    });

    it('menolak kelas dengan sekolah milik guru lain (404)', async () => {
        const seed = await seedAssignment(pool);
        const other = await pool.query(
            `insert into teachers (email, password_hash, nama) values ('lain@example.test','x','Guru Lain') returning id`
        );
        const otherSchool = await createSchool(deps.db, other.rows[0].id, {nama: 'SDN Lain'});

        const error = await caught(() =>
            createClass(deps.db, seed.teacherId, {nama: 'Kelas', schoolId: otherSchool.id})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });

    it('guru lain tidak dapat mengakses kelas guru ini (404)', async () => {
        const seed = await seedAssignment(pool);
        const other = await pool.query(
            `insert into teachers (email, password_hash, nama) values ('lain@example.test','x','Guru Lain') returning id`
        );

        const error = await caught(() =>
            requireAccess(
                deps.db,
                {user: {id: other.rows[0].id, role: 'guru'}},
                {role: 'guru', classId: seed.classId}
            )
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });
});
