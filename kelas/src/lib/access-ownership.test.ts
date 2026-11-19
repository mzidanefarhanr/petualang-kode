import {describe, expect, it} from 'vitest';
import {requireAccess, type Queryable} from './access';

/*
 * Uji tambahan requireAccess untuk kepemilikan snapshot dan submission.
 */

const guru = {user: {id: 'guru-1', role: 'guru'}};
const murid = {user: {id: 'murid-1', role: 'murid'}};

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

const FRAG_GURU_SNAPSHOT = 'from snapshots s';
const FRAG_MURID_SNAPSHOT = 'select class_id from snapshots where id = $1 and student_id = $2';
const FRAG_GURU_SUBMISSION = 'from submissions sub';
const FRAG_MURID_SUBMISSION = 'select class_id from submissions where id = $1 and student_id = $2';

async function caught(fn: () => Promise<unknown>) {
    try {
        await fn();
    } catch (error) {
        return error as {status: number; kode: string};
    }
    throw new Error('Diharapkan error.');
}

describe('requireAccess — snapshot', () => {
    it('murid pemilik boleh mengakses snapshot', async () => {
        const db = fakeDb([[FRAG_MURID_SNAPSHOT, [{class_id: 'c1'}]]]);
        await expect(requireAccess(db, murid, {role: 'murid', snapshotId: 'sn1'})).resolves.toEqual({
            classId: 'c1',
            snapshotId: 'sn1'
        });
    });

    it('murid lain ditolak 404 BUKAN_MILIK_ANDA', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_MURID_SNAPSHOT, []]]), murid, {role: 'murid', snapshotId: 'sn1'})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });

    it('guru pemilik kelas boleh mengakses snapshot', async () => {
        const db = fakeDb([[FRAG_GURU_SNAPSHOT, [{class_id: 'c1'}]]]);
        await expect(requireAccess(db, guru, {role: 'guru', snapshotId: 'sn1'})).resolves.toEqual({
            classId: 'c1',
            snapshotId: 'sn1'
        });
    });

    it('guru kelas lain ditolak 404 BUKAN_MILIK_ANDA', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_GURU_SNAPSHOT, []]]), guru, {role: 'guru', snapshotId: 'sn1'})
        );
        expect(error.status).toBe(404);
        expect(error.kode).toBe('BUKAN_MILIK_ANDA');
    });
});

describe('requireAccess — submission', () => {
    it('murid pemilik boleh mengakses submission', async () => {
        const db = fakeDb([[FRAG_MURID_SUBMISSION, [{class_id: 'c1'}]]]);
        await expect(requireAccess(db, murid, {role: 'murid', submissionId: 'su1'})).resolves.toEqual({
            classId: 'c1',
            submissionId: 'su1'
        });
    });

    it('murid lain ditolak 404', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_MURID_SUBMISSION, []]]), murid, {role: 'murid', submissionId: 'su1'})
        );
        expect(error.status).toBe(404);
    });

    it('guru pemilik kelas boleh mengakses submission', async () => {
        const db = fakeDb([[FRAG_GURU_SUBMISSION, [{class_id: 'c1'}]]]);
        await expect(requireAccess(db, guru, {role: 'guru', submissionId: 'su1'})).resolves.toEqual({
            classId: 'c1',
            submissionId: 'su1'
        });
    });

    it('guru kelas lain ditolak 404', async () => {
        const error = await caught(() =>
            requireAccess(fakeDb([[FRAG_GURU_SUBMISSION, []]]), guru, {role: 'guru', submissionId: 'su1'})
        );
        expect(error.status).toBe(404);
    });
});
