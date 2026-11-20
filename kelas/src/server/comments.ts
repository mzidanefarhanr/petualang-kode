import {ApiError} from '../lib/http/errors';
import type {Queryable} from '../lib/db';
import {MAX_KOMENTAR_PANJANG} from '../lib/config';

export interface CommentRow {
    id: string;
    penulis: {jenis: 'guru' | 'murid'; nama: string};
    isi: string;
    dibuat_pada: Date;
}

export async function createComment(
    db: Queryable,
    input: {submissionId: string; role: 'guru' | 'murid'; userId: string; isi: unknown}
): Promise<{id: string}> {
    const isi = typeof input.isi === 'string' ? input.isi.trim() : '';
    if (!isi) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Komentar tidak boleh kosong.');
    }
    if (isi.length > MAX_KOMENTAR_PANJANG) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', `Komentar maksimal ${MAX_KOMENTAR_PANJANG} karakter.`);
    }

    const teacherId = input.role === 'guru' ? input.userId : null;
    const studentId = input.role === 'murid' ? input.userId : null;

    const {rows} = await db.query(
        `insert into comments (submission_id, penulis_teacher_id, penulis_student_id, isi)
         values ($1, $2, $3, $4)
         returning id`,
        [input.submissionId, teacherId, studentId, isi]
    );
    return rows[0];
}

export async function listComments(db: Queryable, submissionId: string): Promise<CommentRow[]> {
    const {rows} = await db.query(
        `select c.id, c.isi, c.dibuat_pada, c.penulis_teacher_id, c.penulis_student_id,
                t.nama as teacher_nama, s.nama as student_nama
           from comments c
           left join teachers t on t.id = c.penulis_teacher_id
           left join students s on s.id = c.penulis_student_id
          where c.submission_id = $1
          order by c.dibuat_pada asc`,
        [submissionId]
    );
    return rows.map(row => ({
        id: row.id,
        penulis: row.penulis_teacher_id
            ? {jenis: 'guru' as const, nama: row.teacher_nama}
            : {jenis: 'murid' as const, nama: row.student_nama},
        isi: row.isi,
        dibuat_pada: row.dibuat_pada
    }));
}
