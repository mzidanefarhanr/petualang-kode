import {ApiError} from '../lib/http/errors';
import type {Queryable} from '../lib/db';

export interface ClassRow {
    id: string;
    nama: string;
    school: string | null;
    jumlah_murid: number;
    tugas_aktif: number;
    diarsipkan_pada: Date | null;
}

export async function listClasses(db: Queryable, teacherId: string): Promise<ClassRow[]> {
    const {rows} = await db.query(
        `select c.id, c.nama, c.diarsipkan_pada, s.nama as school,
                (select count(*)::int from class_members cm where cm.class_id = c.id) as jumlah_murid,
                (select count(*)::int from assignments a
                  where a.class_id = c.id and now() >= a.dibuka_pada and now() < a.ditutup_pada) as tugas_aktif
           from classes c
           left join schools s on s.id = c.school_id
          where c.teacher_id = $1
          order by c.nama`,
        [teacherId]
    );
    return rows;
}

export async function createClass(
    db: Queryable,
    teacherId: string,
    input: {nama: unknown; schoolId?: unknown}
): Promise<{id: string; nama: string; school_id: string | null; diarsipkan_pada: Date | null}> {
    const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
    if (!nama) {
        throw new ApiError(400, 'PERMINTAAN_TIDAK_VALID', 'Nama kelas wajib diisi.');
    }

    const schoolId = typeof input.schoolId === 'string' && input.schoolId ? input.schoolId : null;
    if (schoolId) {
        const {rows} = await db.query(
            'select id from schools where id = $1 and teacher_id = $2',
            [schoolId, teacherId]
        );
        if (!rows.length) {
            throw new ApiError(404, 'BUKAN_MILIK_ANDA', 'Sekolah tidak ditemukan.');
        }
    }

    const {rows} = await db.query(
        `insert into classes (teacher_id, school_id, nama)
         values ($1, $2, $3)
         returning id, nama, school_id, diarsipkan_pada`,
        [teacherId, schoolId, nama]
    );
    return rows[0];
}
