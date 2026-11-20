import {ApiError} from '../lib/http/errors';
import type {Queryable} from '../lib/db';

export interface SchoolRow {
    id: string;
    nama: string;
    catatan: string | null;
}

export async function listSchools(db: Queryable, teacherId: string): Promise<SchoolRow[]> {
    const {rows} = await db.query(
        'select id, nama, catatan from schools where teacher_id = $1 order by nama',
        [teacherId]
    );
    return rows;
}

export async function createSchool(
    db: Queryable,
    teacherId: string,
    input: {nama: unknown; catatan?: unknown}
): Promise<SchoolRow> {
    const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
    if (!nama) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Nama sekolah wajib diisi.');
    }
    const catatan = typeof input.catatan === 'string' && input.catatan.trim() ? input.catatan.trim() : null;

    const {rows} = await db.query(
        `insert into schools (teacher_id, nama, catatan)
         values ($1, $2, $3)
         returning id, nama, catatan`,
        [teacherId, nama, catatan]
    );
    return rows[0];
}
