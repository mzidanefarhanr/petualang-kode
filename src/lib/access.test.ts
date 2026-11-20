import {describe, expect, it} from 'vitest';
import {
    assertAdminOwnsClass,
    assertAdminOwnsStudent,
    assertStudentInClass,
    requireAdmin,
    requireStudent
} from './access';
import type {Queryable} from './db';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const CLASS_ID = '44444444-4444-4444-8444-444444444444';

describe('requireAdmin & requireStudent', () => {
    it('menolak sesi kosong dengan 401 BELUM_MASUK', () => {
        expect(() => requireAdmin(null)).toThrowError(
            expect.objectContaining({status: 401, kode: 'BELUM_MASUK'})
        );
        expect(() => requireStudent(undefined)).toThrowError(
            expect.objectContaining({status: 401, kode: 'BELUM_MASUK'})
        );
    });

    it('menolak peran yang tidak sesuai dengan 403 PERAN_TIDAK_SESUAI', () => {
        const studentSession = {
            expires: new Date(Date.now() + 60_000).toISOString(),
            user: {id: STUDENT_ID, role: 'student' as const, name: 'Budi', username: 'budi'}
        };
        const adminSession = {
            expires: new Date(Date.now() + 60_000).toISOString(),
            user: {id: ADMIN_ID, role: 'admin' as const, name: 'Admin'}
        };

        expect(() => requireAdmin(studentSession)).toThrowError(
            expect.objectContaining({status: 403, kode: 'PERAN_TIDAK_SESUAI'})
        );
        expect(() => requireStudent(adminSession)).toThrowError(
            expect.objectContaining({status: 403, kode: 'PERAN_TIDAK_SESUAI'})
        );
    });

    it('mengembalikan aktor ketika sesi dan peran sesuai', () => {
        const adminSession = {
            expires: new Date(Date.now() + 60_000).toISOString(),
            user: {id: ADMIN_ID, role: 'admin' as const, name: 'Admin'}
        };
        const studentSession = {
            expires: new Date(Date.now() + 60_000).toISOString(),
            user: {id: STUDENT_ID, role: 'student' as const, name: 'Budi', username: 'budi'}
        };

        expect(requireAdmin(adminSession)).toMatchObject({id: ADMIN_ID, role: 'admin'});
        expect(requireStudent(studentSession)).toMatchObject({
            id: STUDENT_ID,
            role: 'student',
            username: 'budi'
        });
    });
});

describe('pemeriksaan kepemilikan sumber daya', () => {
    it('menolak ID bukan UUID dengan 404', async () => {
        const fakeDb: Queryable = {query: async () => ({rows: []})};
        await expect(assertAdminOwnsClass(fakeDb, ADMIN_ID, 'bukan-uuid')).rejects.toMatchObject({
            status: 404
        });
        await expect(assertAdminOwnsStudent(fakeDb, ADMIN_ID, 'bukan-uuid')).rejects.toMatchObject({
            status: 404
        });
        await expect(assertStudentInClass(fakeDb, STUDENT_ID, 'bukan-uuid')).rejects.toMatchObject({
            status: 404
        });
    });

    it('assertAdminOwnsClass menerima kelas milik admin dan menolak milik admin lain (404)', async () => {
        const fakeDb: Queryable = {
            query: async (_sql, params) => {
                if (params?.[0] === CLASS_ID && params?.[1] === ADMIN_ID) {
                    return {
                        rows: [{id: CLASS_ID, nama: 'Kelas 5A', deskripsi: null, diarsipkan_pada: null}]
                    };
                }
                return {rows: []};
            }
        };

        const owned = await assertAdminOwnsClass(fakeDb, ADMIN_ID, CLASS_ID);
        expect(owned.nama).toBe('Kelas 5A');

        await expect(assertAdminOwnsClass(fakeDb, OTHER_ADMIN_ID, CLASS_ID)).rejects.toMatchObject({
            status: 404,
            kode: 'KELAS_TIDAK_DITEMUKAN'
        });
    });

    it('assertStudentInClass memeriksa keanggotaan kelas aktif', async () => {
        const fakeDb: Queryable = {
            query: async (_sql, params) => {
                if (params?.[0] === STUDENT_ID && params?.[1] === CLASS_ID) {
                    return {rows: [{id: CLASS_ID, nama: 'Kelas 5A', admin_id: ADMIN_ID}]};
                }
                return {rows: []};
            }
        };

        const cls = await assertStudentInClass(fakeDb, STUDENT_ID, CLASS_ID);
        expect(cls.id).toBe(CLASS_ID);

        await expect(
            assertStudentInClass(fakeDb, '99999999-9999-4999-8999-999999999999', CLASS_ID)
        ).rejects.toMatchObject({
            status: 404,
            kode: 'KELAS_TIDAK_DITEMUKAN'
        });
    });
});
