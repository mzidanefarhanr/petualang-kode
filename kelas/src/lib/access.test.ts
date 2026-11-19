import {describe, expect, it} from 'vitest';
import {requireAccess, type Queryable} from './access';
import {ApiError} from './http/errors';

const guru = {user: {id: 'guru-1', role: 'guru'}};
const murid = {user: {id: 'murid-1', role: 'murid'}};

/*
 * Database palsu: mengembalikan baris berdasarkan fragmen SQL yang cocok.
 * Memungkinkan pengujian urutan 401 -> 403 -> 404 tanpa PostgreSQL nyata.
 */
function fakeDb(responses: Array<[fragment: string, rows: unknown[]]>): Queryable {
    return {
        query: async (text: string) => {
            for (const [fragment, rows] of responses) {
                if (text.includes(fragment)) {
                    return {rows};
                }
            }
            return {rows: []};
        }
    };
}

const FRAG_GURU_CLASS = 'from classes where id = $1 and teacher_id = $2';
const FRAG_MURID_CLASS = 'from class_members where class_id = $1 and student_id = $2';
const FRAG_GURU_ASSIGNMENT = 'join classes c on c.id = a.class_id';
const FRAG_MURID_ASSIGNMENT = 'join class_members cm';

async function caught(fn: () => Promise<unknown>): Promise<ApiError> {
    try {
        await fn();
    } catch (error) {
        if (error instanceof ApiError) {
            return error;
        }
        throw error;
    }
    throw new Error('Diharapkan ApiError, tetapi tidak ada error yang dilempar.');
}

describe('requireAccess — autentikasi dan peran', () => {
    it('tanpa sesi menghasilkan 401 BELUM_MASUK', async () => {
        const error = await caught(() => requireAccess(fakeDb([]), null, {role: 'guru', classId: 'c1'}));
        expect(error.status).toBe(401);
        expect(error.kode).toBe('BELUM_MASUK');
    });

    it('peran tidak sesuai menghasilkan 403 PERAN_TIDAK_SESUAI', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([]), murid, {role: 'guru', classId: 'c1'})
        );
        expect(error.status).toBe(403);
        expect(error.kode).toBe('PERAN_TIDAK_SESUAI');
    });
});

describe('requireAccess — guru hanya kelas miliknya', () => {
    it('guru boleh mengakses kelas miliknya', async () => {
        const db = fakeDb([[FRAG_GURU_CLASS, [{id: 'c1'}]]]);
        await expect(requireAccess(db, guru, {role: 'guru', classId: 'c1'})).resolves.toEqual({classId: 'c1'});
    });

    it('guru tidak boleh mengakses kelas guru lain -> 404', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_GURU_CLASS, []]]), guru, {role: 'guru', classId: 'c-lain'})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });

    it('guru boleh mengakses tugas di kelas miliknya', async () => {
        const db = fakeDb([[FRAG_GURU_ASSIGNMENT, [{class_id: 'c1'}]]]);
        await expect(requireAccess(db, guru, {role: 'guru', assignmentId: 'a1'})).resolves.toEqual({
            classId: 'c1',
            assignmentId: 'a1'
        });
    });

    it('guru tidak boleh mengakses tugas kelas guru lain -> 404', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_GURU_ASSIGNMENT, []]]), guru, {role: 'guru', assignmentId: 'a-lain'})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });
});

describe('requireAccess — murid hanya kelas yang diikuti', () => {
    it('murid anggota boleh mengakses kelas', async () => {
        const db = fakeDb([[FRAG_MURID_CLASS, [{ok: 1}]]]);
        await expect(requireAccess(db, murid, {role: 'murid', classId: 'c1'})).resolves.toEqual({classId: 'c1'});
    });

    it('murid bukan anggota -> 404 BUKAN_ANGGOTA', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_MURID_CLASS, []]]), murid, {role: 'murid', classId: 'c-lain'})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_ANGGOTA');
    });

    it('murid anggota boleh mengakses tugas kelasnya', async () => {
        const db = fakeDb([[FRAG_MURID_ASSIGNMENT, [{class_id: 'c1'}]]]);
        await expect(requireAccess(db, murid, {role: 'murid', assignmentId: 'a1'})).resolves.toEqual({
            classId: 'c1',
            assignmentId: 'a1'
        });
    });

    it('murid bukan anggota kelas tugas -> 404 BUKAN_ANGGOTA', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_MURID_ASSIGNMENT, []]]), murid, {role: 'murid', assignmentId: 'a-lain'})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_ANGGOTA');
    });
});
